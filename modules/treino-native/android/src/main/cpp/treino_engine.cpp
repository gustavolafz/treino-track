#include <jni.h>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace {

inline double epley1RM(double weightKg, int32_t reps) noexcept {
  if (weightKg <= 0.0 || reps <= 0) return 0.0;
  if (reps == 1) return std::round(weightKg * 10.0) / 10.0;
  const int32_t clamped = std::min<int32_t>(reps, 20);
  const double raw = weightKg * (1.0 + static_cast<double>(clamped) / 30.0);
  return std::round(raw * 10.0) / 10.0;
}

inline void computeSeriesCore(
    const double* __restrict weights,
    const int32_t* __restrict reps,
    const int32_t* __restrict completed,
    const int32_t* __restrict offsets,
    int32_t totalSets,
    int32_t sessionCount,
    double* __restrict out) noexcept {
  for (int32_t s = 0; s < sessionCount; ++s) {
    const int32_t start = std::max<int32_t>(0, offsets[s]);
    const int32_t end = std::min<int32_t>(totalSets, offsets[s + 1]);

    double maxWeight = 0.0;
    double max1RM = 0.0;
    double totalReps = 0.0;
    double totalVolume = 0.0;

    for (int32_t i = start; i < end; ++i) {
      if (completed[i] == 0) continue;
      const double w = weights[i] > 0.0 ? weights[i] : 0.0;
      const int32_t r = reps[i] > 0 ? reps[i] : 0;

      if (w > maxWeight) maxWeight = w;
      const double est = epley1RM(w, r);
      if (est > max1RM) max1RM = est;
      totalReps += static_cast<double>(r);
      totalVolume += w * static_cast<double>(r);
    }

    const size_t base = static_cast<size_t>(s) * 4U;
    out[base] = std::round(maxWeight * 10.0) / 10.0;
    out[base + 1] = max1RM;
    out[base + 2] = totalReps;
    out[base + 3] = std::round(totalVolume * 10.0) / 10.0;
  }
}

}  // namespace

extern "C" {

JNIEXPORT jdouble JNICALL
Java_com_treinotrack_nativeengine_TreinoNativeModule_nativeEstimate1RM(
    JNIEnv* /* env */,
    jobject /* thiz */,
    jdouble weightKg,
    jint reps) {
  return epley1RM(weightKg, reps);
}

JNIEXPORT jdoubleArray JNICALL
Java_com_treinotrack_nativeengine_TreinoNativeModule_nativeComputeSetSeries(
    JNIEnv* env,
    jobject /* thiz */,
    jdoubleArray jWeights,
    jintArray jReps,
    jintArray jCompleted,
    jintArray jSessionOffsets,
    jint sessionCount) {
  if (sessionCount <= 0 || !jWeights || !jReps || !jCompleted || !jSessionOffsets) {
    return env->NewDoubleArray(0);
  }

  const jsize totalSets = env->GetArrayLength(jWeights);
  const jsize offsetLen = env->GetArrayLength(jSessionOffsets);
  if (offsetLen < sessionCount + 1) {
    return env->NewDoubleArray(0);
  }

  jboolean isCopy = JNI_FALSE;
  jdouble* weights = env->GetDoubleArrayElements(jWeights, &isCopy);
  jint* reps = env->GetIntArrayElements(jReps, &isCopy);
  jint* completed = env->GetIntArrayElements(jCompleted, &isCopy);
  jint* offsets = env->GetIntArrayElements(jSessionOffsets, &isCopy);

  std::vector<double> out(static_cast<size_t>(sessionCount) * 4U, 0.0);
  if (weights && reps && completed && offsets) {
    computeSeriesCore(
        weights,
        reps,
        completed,
        offsets,
        totalSets,
        sessionCount,
        out.data());
  }

  if (weights) env->ReleaseDoubleArrayElements(jWeights, weights, JNI_ABORT);
  if (reps) env->ReleaseIntArrayElements(jReps, reps, JNI_ABORT);
  if (completed) env->ReleaseIntArrayElements(jCompleted, completed, JNI_ABORT);
  if (offsets) env->ReleaseIntArrayElements(jSessionOffsets, offsets, JNI_ABORT);

  jdoubleArray result = env->NewDoubleArray(static_cast<jsize>(out.size()));
  if (result) {
    env->SetDoubleArrayRegion(result, 0, static_cast<jsize>(out.size()), out.data());
  }
  return result;
}

// Zero-copy direct ByteBuffer JSI TypedArray path
JNIEXPORT jboolean JNICALL
Java_com_treinotrack_nativeengine_TreinoNativeModule_nativeComputeSetSeriesBuffer(
    JNIEnv* env,
    jobject /* thiz */,
    jobject jWeightsBuf,
    jobject jRepsBuf,
    jobject jCompletedBuf,
    jobject jOffsetsBuf,
    jobject jOutBuf,
    jint totalSets,
    jint sessionCount) {
  if (sessionCount <= 0 || totalSets <= 0 || !jWeightsBuf || !jRepsBuf || !jCompletedBuf ||
      !jOffsetsBuf || !jOutBuf) {
    return JNI_FALSE;
  }

  const auto* weights = static_cast<const double*>(env->GetDirectBufferAddress(jWeightsBuf));
  const auto* reps = static_cast<const int32_t*>(env->GetDirectBufferAddress(jRepsBuf));
  const auto* completed = static_cast<const int32_t*>(env->GetDirectBufferAddress(jCompletedBuf));
  const auto* offsets = static_cast<const int32_t*>(env->GetDirectBufferAddress(jOffsetsBuf));
  auto* out = static_cast<double*>(env->GetDirectBufferAddress(jOutBuf));

  if (!weights || !reps || !completed || !offsets || !out) {
    return JNI_FALSE;
  }

  computeSeriesCore(weights, reps, completed, offsets, totalSets, sessionCount, out);
  return JNI_TRUE;
}

}  // extern "C"
