package com.treinotrack.nativeengine

import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.HapticFeedbackConstants
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.typedarray.Float64Array
import expo.modules.kotlin.typedarray.Int32Array
import java.nio.ByteBuffer

class TreinoNativeModule : Module() {
  private val mainHandler = Handler(Looper.getMainLooper())

  companion object {
    init {
      System.loadLibrary("treino_engine")
    }
  }

  private external fun nativeEstimate1RM(weightKg: Double, reps: Int): Double

  private external fun nativeComputeSetSeries(
    weights: DoubleArray,
    reps: IntArray,
    completed: IntArray,
    sessionOffsets: IntArray,
    sessionCount: Int,
  ): DoubleArray

  private external fun nativeComputeSetSeriesBuffer(
    weightsBuf: ByteBuffer,
    repsBuf: ByteBuffer,
    completedBuf: ByteBuffer,
    offsetsBuf: ByteBuffer,
    outBuf: ByteBuffer,
    totalSets: Int,
    sessionCount: Int,
  ): Boolean

  override fun definition() = ModuleDefinition {
    Name("TreinoNative")

    Function("hapticTap") { kind: Int ->
      val view = appContext.activityProvider?.currentActivity?.window?.decorView ?: return@Function
      val constant = when (kind) {
        1 -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          HapticFeedbackConstants.CONFIRM
        } else {
          HapticFeedbackConstants.CONTEXT_CLICK
        }
        2 -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
          HapticFeedbackConstants.REJECT
        } else {
          HapticFeedbackConstants.LONG_PRESS
        }
        else -> HapticFeedbackConstants.KEYBOARD_TAP
      }
      if (Looper.myLooper() == Looper.getMainLooper()) {
        view.performHapticFeedback(constant)
      } else {
        mainHandler.post { view.performHapticFeedback(constant) }
      }
    }

    Function("estimate1RM") { weightKg: Double, reps: Int ->
      nativeEstimate1RM(weightKg, reps)
    }

    Function("computeSetSeries") {
        weights: DoubleArray,
        reps: IntArray,
        completed: IntArray,
        sessionOffsets: IntArray,
        sessionCount: Int ->
      nativeComputeSetSeries(weights, reps, completed, sessionOffsets, sessionCount)
    }

    Function("computeSetSeriesBuffer") {
        weights: Float64Array,
        reps: Int32Array,
        completed: Int32Array,
        sessionOffsets: Int32Array,
        outSeries: Float64Array,
        sessionCount: Int ->
      if (sessionCount <= 0 || weights.length <= 0) return@Function false
      if (sessionOffsets.length < sessionCount + 1 || outSeries.length < sessionCount * 4) {
        return@Function false
      }
      val wBuf = weights.toDirectBuffer()
      val rBuf = reps.toDirectBuffer()
      val cBuf = completed.toDirectBuffer()
      val oBuf = sessionOffsets.toDirectBuffer()
      val outBuf = outSeries.toDirectBuffer()
      if (!wBuf.isDirect || !rBuf.isDirect || !cBuf.isDirect || !oBuf.isDirect || !outBuf.isDirect) {
        return@Function false
      }
      nativeComputeSetSeriesBuffer(
        wBuf,
        rBuf,
        cBuf,
        oBuf,
        outBuf,
        weights.length,
        sessionCount
      )
    }
  }
}
