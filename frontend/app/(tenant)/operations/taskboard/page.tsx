'use client';
import dynamic from 'next/dynamic';
const TaskBoard = dynamic(() => import('../../../../src/features/tenant/operations/tasks/ui/task-board'), { ssr: false });
export default TaskBoard;
