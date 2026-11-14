import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  Button,
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Text,
} from '@/components/ui';
import type { BodyMetricEntry } from '@/types/workout';

interface BodyMetricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  todayISO: string;
  onSave: (entry: Omit<BodyMetricEntry, 'id'>) => void;
}

export const BodyMetricDialog = React.memo(function BodyMetricDialog({
  open,
  onOpenChange,
  todayISO,
  onSave,
}: BodyMetricDialogProps) {
  const [bmDate, setBmDate] = useState(todayISO);
  const [bmWeight, setBmWeight] = useState('');
  const [bmBf, setBmBf] = useState('');
  const [bmWaist, setBmWaist] = useState('');
  const [bmNotes, setBmNotes] = useState('');

  useEffect(() => {
    if (open) {
      setBmDate(todayISO);
    }
  }, [open, todayISO]);

  const handleSave = () => {
    const w = parseFloat(bmWeight.replace(',', '.'));
    if (Number.isNaN(w) || w <= 0) return;
    const bf = bmBf ? parseFloat(bmBf.replace(',', '.')) : undefined;
    const waist = bmWaist ? parseFloat(bmWaist.replace(',', '.')) : undefined;

    onSave({
      date: bmDate.trim() || todayISO,
      weightKg: Math.round(w * 10) / 10,
      bodyFatPct: bf && !Number.isNaN(bf) ? Math.round(bf * 10) / 10 : undefined,
      waistCm: waist && !Number.isNaN(waist) ? Math.round(waist * 10) / 10 : undefined,
      notes: bmNotes.trim() || undefined,
    });

    setBmWeight('');
    setBmBf('');
    setBmWaist('');
    setBmNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>Registrar Peso & BF%</DialogTitle>
        <DialogDescription>
          Salve sua pesagem e medidas para acompanhar o gráfico de evolução corporal.
        </DialogDescription>
      </DialogHeader>
      <View className="gap-3">
        <View>
          <Label>Data (AAAA-MM-DD)</Label>
          <Input value={bmDate} onChangeText={setBmDate} placeholder={todayISO} />
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Label>Peso (kg) *</Label>
            <Input
              value={bmWeight}
              onChangeText={setBmWeight}
              keyboardType="decimal-pad"
              placeholder="Ex: 80.5"
            />
          </View>
          <View className="flex-1">
            <Label>BF (%)</Label>
            <Input
              value={bmBf}
              onChangeText={setBmBf}
              keyboardType="decimal-pad"
              placeholder="Ex: 15.6"
            />
          </View>
        </View>
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Label>Cintura (cm, opcional)</Label>
            <Input
              value={bmWaist}
              onChangeText={setBmWaist}
              keyboardType="decimal-pad"
              placeholder="Ex: 82.5"
            />
          </View>
        </View>
        <View>
          <Label>Observação (opcional)</Label>
          <Input
            value={bmNotes}
            onChangeText={setBmNotes}
            placeholder="Ex: Em jejum pela manhã"
          />
        </View>
      </View>
      <DialogFooter>
        <Button variant="outline" onPress={() => onOpenChange(false)}>
          <Text>Cancelar</Text>
        </Button>
        <Button onPress={handleSave}>
          <Text>Salvar Medição</Text>
        </Button>
      </DialogFooter>
    </Dialog>
  );
});
