import { Layer, ManagedRuntime } from "effect"
import { PermissionService } from "@/permission/service"
import { QuestionService } from "@/question/service"

// AccountService and AuthService removed — external tenant system handles auth
export const runtime = ManagedRuntime.make(
  Layer.mergeAll(PermissionService.layer, QuestionService.layer),
)
