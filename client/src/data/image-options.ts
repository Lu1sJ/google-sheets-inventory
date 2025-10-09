export interface ImageOption {
  value: string;
  label: string;
}

export const IMAGE_OPTIONS: ImageOption[] = [
  {
    value: "Public",
    label: "Public"
  },
  {
    value: "Staff",
    label: "Staff"
  },
  {
    value: "Lab",
    label: "Lab"
  },
  {
    value: "Server",
    label: "Server"
  }
];

export const getImageOption = (value: string): ImageOption | undefined => {
  return IMAGE_OPTIONS.find(option => 
    option.value.toLowerCase() === value.toLowerCase() ||
    option.label.toLowerCase() === value.toLowerCase()
  );
};