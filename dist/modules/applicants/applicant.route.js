import { Router } from "express";
import { handleListApplicants } from "./applicant.controller.js";
import { authenticate } from "../../middlewares/token.middleware.js";
export const applicantRouter = Router();
applicantRouter.get("/", authenticate, handleListApplicants);
export default applicantRouter;
//# sourceMappingURL=applicant.route.js.map