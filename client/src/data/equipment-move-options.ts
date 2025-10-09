export interface EquipmentMoveOption {
  value: string;
  label: string;
}

export const EQUIPMENT_MOVE_OPTIONS: EquipmentMoveOption[] = [
  {
    value: "Yes",
    label: "Yes"
  },
  {
    value: "No",
    label: "No"
  }
];

export function getEquipmentMoveOption(value: string): EquipmentMoveOption | undefined {
  const normalizedValue = value.toLowerCase().trim();
  
  // Support common synonyms
  const valueMap: Record<string, string> = {
    'yes': 'Yes',
    'y': 'Yes',
    'true': 'Yes',
    '1': 'Yes',
    'no': 'No',
    'n': 'No',
    'false': 'No',
    '0': 'No'
  };
  
  const mappedValue = valueMap[normalizedValue];
  if (mappedValue) {
    return EQUIPMENT_MOVE_OPTIONS.find(option => option.value === mappedValue);
  }
  
  // Fallback to exact match
  return EQUIPMENT_MOVE_OPTIONS.find(option => option.value === value);
}