export const PRODUCT_MESSAGES = {
  NOT_FOUND: "Product not found.",
  SLUG_EXISTS: "A product with this name already exists.",
  CATEGORY_NOT_FOUND: "Category not found.",
  CATEGORY_INACTIVE: "Products cannot use an inactive category.",
  INVALID_STOCK: "Stock adjustment would result in an invalid stock state.",
  HAS_ORDER_ITEMS: "Products linked to orders cannot be permanently deleted.",
} as const;
