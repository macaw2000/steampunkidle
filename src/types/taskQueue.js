"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskEventType = exports.ValidationBypassReason = exports.TaskType = void 0;
var TaskType;
(function (TaskType) {
    TaskType["HARVESTING"] = "harvesting";
    TaskType["COMBAT"] = "combat";
    TaskType["CRAFTING"] = "crafting";
})(TaskType = exports.TaskType || (exports.TaskType = {}));
var ValidationBypassReason;
(function (ValidationBypassReason) {
    ValidationBypassReason["ADMIN_OVERRIDE"] = "admin_override";
    ValidationBypassReason["TESTING"] = "testing";
    ValidationBypassReason["DEBUG"] = "debug";
    ValidationBypassReason["EMERGENCY"] = "emergency";
    ValidationBypassReason["MAINTENANCE"] = "maintenance";
})(ValidationBypassReason = exports.ValidationBypassReason || (exports.ValidationBypassReason = {}));
var TaskEventType;
(function (TaskEventType) {
    TaskEventType["TASK_ADDED"] = "task_added";
    TaskEventType["TASK_STARTED"] = "task_started";
    TaskEventType["TASK_PROGRESS"] = "task_progress";
    TaskEventType["TASK_COMPLETED"] = "task_completed";
    TaskEventType["TASK_FAILED"] = "task_failed";
    TaskEventType["TASK_CANCELLED"] = "task_cancelled";
    TaskEventType["QUEUE_PAUSED"] = "queue_paused";
    TaskEventType["QUEUE_RESUMED"] = "queue_resumed";
    TaskEventType["QUEUE_CLEARED"] = "queue_cleared";
})(TaskEventType = exports.TaskEventType || (exports.TaskEventType = {}));
