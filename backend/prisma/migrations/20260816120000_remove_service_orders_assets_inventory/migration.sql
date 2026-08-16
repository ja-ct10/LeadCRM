-- DropTable: Remove Service Orders, Assets, and Inventory modules

-- Drop InventoryItem table
DROP TABLE IF EXISTS "InventoryItem";

-- Drop Asset table
DROP TABLE IF EXISTS "Asset";

-- Drop ServiceOrder table
DROP TABLE IF EXISTS "ServiceOrder";
