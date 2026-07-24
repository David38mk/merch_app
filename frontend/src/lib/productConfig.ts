// A seller's chosen configuration for a blank, carried into the design / hire flow.
export interface ProductConfig {
  base_item_id: string;
  name: string;
  image_url: string | null;
  provider: string;
  color: string;
  size: string;
  material: string | null;
  print_type: string | null;
  print_position: string | null;
  unit_price: number;
}
