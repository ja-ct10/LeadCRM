import { describe, it, expect, vi } from 'vitest';
import { validateModuleConfig } from './validate-module-config';
import type { ModuleConfig, ColumnDefinition } from '@leadcrm/shared';

const validColumn: ColumnDefinition = {
  id: 'name',
  label: 'Name',
  required: true,
  defaultVisible: true,
  defaultOrder: 0,
  priority: 'required',
};

function buildValidConfig(overrides: Partial<ModuleConfig> = {}): ModuleConfig {
  return {
    moduleId: 'leads',
    columnRegistry: [validColumn],
    availableViews: ['table'],
    ...overrides,
  };
}

describe('validateModuleConfig', () => {
  it('accepts a valid Module_Config without throwing', () => {
    expect(() => validateModuleConfig(buildValidConfig())).not.toThrow();
  });

  it('throws when moduleId is empty string', () => {
    expect(() => validateModuleConfig(buildValidConfig({ moduleId: '' }))).toThrow(
      '[Data_View_System] Module_Config rejected: moduleId is empty'
    );
  });

  it('throws when moduleId is whitespace-only', () => {
    expect(() => validateModuleConfig(buildValidConfig({ moduleId: '   ' }))).toThrow(
      '[Data_View_System] Module_Config rejected: moduleId is empty'
    );
  });

  it('throws when columnRegistry is empty array', () => {
    expect(() => validateModuleConfig(buildValidConfig({ columnRegistry: [] }))).toThrow(
      '[Data_View_System] Module_Config rejected: columnRegistry is empty'
    );
  });

  it('throws when availableViews is empty array', () => {
    const config = buildValidConfig();
    // Force empty availableViews (bypassing tuple type for runtime test)
    (config as unknown as { availableViews: never[] }).availableViews = [];
    expect(() => validateModuleConfig(config)).toThrow(
      '[Data_View_System] Module_Config rejected: availableViews is empty'
    );
  });

  it('warns when kanbanGroupingField does not match a column ID', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateModuleConfig(
      buildValidConfig({
        kanbanGroupingField: 'nonexistent-field',
      })
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('does not reference a valid column ID')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('nonexistent-field')
    );

    warnSpy.mockRestore();
  });

  it('does not warn when kanbanGroupingField matches a valid column ID', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateModuleConfig(
      buildValidConfig({
        kanbanGroupingField: 'name',
      })
    );

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('does not warn when kanbanGroupingField is not provided', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    validateModuleConfig(buildValidConfig());

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
