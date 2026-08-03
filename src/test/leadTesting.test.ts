import { describe, expect, it } from 'vitest';
import { drinkingStatusLabel, formatLeadMeasurement, formatPpb, normalizeLeadResult, overallWorkflowLabel, requiredActionLabel } from '@/lib/leadTesting';

describe('lead result workflow', () => {
  it.each([
    ['4.9','5 ppb or less','No remediation required'], ['5','5 ppb or less','No remediation required'],
    ['5.1','Greater than 5 through 15 ppb','Remediation required'], ['15','Greater than 5 through 15 ppb','Remediation required'],
    ['15.1','Greater than 15 ppb','Immediately restrict access and remediate'],
  ])('%s ppb is categorized correctly',(value,category,action)=>{const r=normalizeLeadResult(value,'ppb');expect(r.category).toBe(category);expect(r.requiredAction).toBe(action)});
  it('verifies an exactly 5 ppb post-remediation retest',()=>expect(normalizeLeadResult('5','ppb',true).requiredAction).toBe('Remediation verified'));
  it('requires more remediation when a retest remains high',()=>expect(normalizeLeadResult('5.1','ppb',true).requiredAction).toBe('Additional remediation required'));
  it('converts mg/L and ppm to ppb',()=>{expect(normalizeLeadResult('0.008','mg/L').ppb).toBe(8);expect(normalizeLeadResult('0.015','ppm').ppb).toBe(15)});
  it('displays normalized ppb as whole numbers',()=>{expect(formatPpb(1.49)).toBe('1');expect(formatPpb(1.5)).toBe('2');expect(formatPpb(normalizeLeadResult('0.008','mg/L').ppb)).toBe('8')});
  it('preserves non-detect notation without inventing a value',()=>{const r=normalizeLeadResult('ND','ppb');expect(r.original).toBe('ND');expect(r.ppb).toBeNull();expect(r.category).toBeNull()});
  it('categorizes a reliable less-than bound without inventing a value',()=>{const r=normalizeLeadResult('<0.5','ppb');expect(r.category).toBe('5 ppb or less');expect(r.ppb).toBeNull()});
  it('displays less-than results in normalized whole ppb',()=>{expect(formatLeadMeasurement('<1','ppb',null)).toBe('<1 ppb');expect(formatLeadMeasurement('<0.001','mg/L',null)).toBe('<1 ppb')});
  it('rejects invalid units and negative values',()=>{expect(()=>normalizeLeadResult('1','oz')).toThrow();expect(()=>normalizeLeadResult('-1','ppb')).toThrow()});
});

describe('plain-language fixture summary', () => {
  it('maps internal states to the required workflow labels', () => {
    expect(requiredActionLabel('not_started')).toBe('Sampling Required');
    expect(requiredActionLabel('awaiting_results')).toBe('Awaiting Results');
    expect(requiredActionLabel('action_required', 'Immediately restrict access and remediate')).toBe('Immediately Restrict Access');
    expect(overallWorkflowLabel('awaiting_retest')).toBe('Retesting Required');
    expect(overallWorkflowLabel('complete')).toBe('Complete');
  });
  it('maps availability to drinking status', () => {
    expect(drinkingStatusLabel('available_for_consumption')).toBe('Ready for Consumption');
    expect(drinkingStatusLabel('temporarily_restricted')).toBe('Restricted – Do Not Drink');
    expect(drinkingStatusLabel('shut_off')).toBe('Out of Service');
  });
});
