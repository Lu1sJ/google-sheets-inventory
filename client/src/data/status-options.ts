export interface StatusOption {
  value: string;
  label: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "Installed",
    label: "Installed"
  },
  {
    value: "Decommissioned",
    label: "Decommissioned"
  },
  {
    value: "Disconnected",
    label: "Disconnected"
  },
  {
    value: "Damaged",
    label: "Damaged"
  },
  {
    value: "Out for Repair",
    label: "Out for Repair"
  },
  {
    value: "In Stock",
    label: "In Stock"
  },
  {
    value: "Stolen",
    label: "Stolen"
  },
  {
    value: "RMA",
    label: "RMA"
  },
  {
    value: "Legacy",
    label: "Legacy"
  },
  {
    value: "Missing",
    label: "Missing"
  },
  {
    value: "Borrowed",
    label: "Borrowed"
  },
  {
    value: "NGD Stock",
    label: "NGD Stock"
  }
];

export const getStatusOption = (value: string): StatusOption | undefined => {
  return STATUS_OPTIONS.find(option => 
    option.value.toLowerCase() === value.toLowerCase() ||
    option.label.toLowerCase() === value.toLowerCase()
  );
};