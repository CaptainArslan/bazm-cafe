import { Router } from "express";
import { authRouter } from "../modules/auth/index.js";
import { categoriesRouter } from "../modules/categories/index.js";
import { customersRouter } from "../modules/customers/index.js";
import {
  guestRouter,
  guestSessionsStaffRouter,
} from "../modules/guest-sessions/index.js";
import { ordersRouter } from "../modules/orders/index.js";
import {
  orderPaymentsRouter,
  paymentsRouter,
} from "../modules/payments/index.js";
import { productsRouter } from "../modules/products/index.js";
import { receiptsRouter } from "../modules/receipts/receipt.routes.js";
import { settingsRouter } from "../modules/settings/index.js";
import { staffRouter } from "../modules/staff/index.js";
import { tablesRouter } from "../modules/tables/index.js";
import { sendSuccess } from "../utils/api-response.js";

export const apiRouter = Router();

apiRouter.get("/", (_request, response) => {
  return sendSuccess(response, {
    message: "BAZM Cafe API v1 is available.",
    data: {
      version: "1.0.0",
    },
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/staff", staffRouter);
apiRouter.use("/customers", customersRouter);
apiRouter.use("/tables", tablesRouter);
apiRouter.use("/categories", categoriesRouter);
apiRouter.use("/products", productsRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/guest", guestRouter);
apiRouter.use("/guest-sessions", guestSessionsStaffRouter);
apiRouter.use("/receipts", receiptsRouter);
apiRouter.use("/orders", ordersRouter);
apiRouter.use("/orders/:orderId/payments", orderPaymentsRouter);
apiRouter.use("/payments", paymentsRouter);
