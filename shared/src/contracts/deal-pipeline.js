"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoveDealPipelineSchema = void 0;
const zod_1 = require("zod");
/** Pipeline and stage must be committed together by the transfer endpoint. */
exports.MoveDealPipelineSchema = zod_1.z.object({
    pipelineId: zod_1.z.string().trim().min(1),
    stageId: zod_1.z.string().trim().min(1),
}).strict();
