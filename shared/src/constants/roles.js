"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = void 0;
// RBAC Roles — defined once, imported by both frontend and backend
// Adding a new role: add it here only. Code elsewhere stays the same.
exports.Role = {
    ADMIN: 'Admin',
    SUPER_USER: 'Super User',
    USER: 'User',
    RESTRICTED_USER: 'Restricted User',
};
