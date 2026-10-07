import { Router } from "express";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { catalogRouter } from "./catalog";
import { favoriteRouter } from "./favorites";
import { listingRouter } from "./listings";
import { conversationRouter, messageRouter } from "./messages";
import { notificationRouter } from "./notifications";
import { offerRouter } from "./offers";
import { reportRouter } from "./reports";
import { reviewRouter } from "./reviews";
import { uploadRouter } from "./uploads";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/listings", listingRouter);
apiRouter.use("/favorites", favoriteRouter);
apiRouter.use("/messages", messageRouter);
apiRouter.use("/conversations", conversationRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/reports", reportRouter);
apiRouter.use("/reviews", reviewRouter);
apiRouter.use("/offers", offerRouter);
apiRouter.use("/uploads", uploadRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use(catalogRouter);
