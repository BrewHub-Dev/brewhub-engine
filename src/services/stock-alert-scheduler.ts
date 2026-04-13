import { db } from "@/db/mongo";
import { logger } from "@/utils/logger";

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

async function checkAllShopsStock() {
  try {
    const shops = db.collection("shops");
    const branches = db.collection("branches");

    const shopList = await shops.find({ active: true }).toArray();

    for (const shop of shopList) {
      const branchList = await branches.find({ ShopId: shop._id }).toArray();

      for (const branch of branchList) {
        const { checkAndSendStockAlerts } = await import("@/features/stock/stock.service");
        const result = await checkAndSendStockAlerts(branch._id.toString(), shop._id.toString());

        if (result.count > 0) {
          logger.info(`[StockAlert] Shop ${shop.name}: ${result.count} items bajo stock (15%), email enviado: ${result.sent}`);
        }
      }
    }
  } catch (err) {
    logger.error({ err }, "[StockAlert] Error en verificación periódica");
  }
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startStockAlertScheduler() {
  if (intervalId) {
    logger.warn("[StockAlert] Scheduler ya está corriendo");
    return;
  }

  logger.info(`[StockAlert] Scheduler iniciado (cada ${CHECK_INTERVAL_MS / 1000 / 60} minutos)`);

  checkAllShopsStock();

  intervalId = setInterval(checkAllShopsStock, CHECK_INTERVAL_MS);
}

export function stopStockAlertScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("[StockAlert] Scheduler detenido");
  }
}