// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const budgetScript = readFileSync(
  path.resolve(process.cwd(), 'services/replacement-budget/desktop_static/app.js'),
  'utf8',
);

function runBudgetScript() {
  window.eval(budgetScript);
}

describe('replacement budget interactions', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('selects and clears every school from the school dropdown', () => {
    document.body.innerHTML = `
      <form data-school-form>
        <strong data-school-summary></strong>
        <span data-school-selection-names></span>
        <input type="checkbox" data-select-schools>
        <button type="button" data-clear-schools>Clear</button>
        <input type="checkbox" name="school_id" value="school-a" data-school-name="Cedar Valley Elementary">
        <input type="checkbox" name="school_id" value="school-b" data-school-name="Port Susan Middle">
        <strong data-school-count></strong>
      </form>
    `;
    runBudgetScript();

    const selectAll = document.querySelector<HTMLInputElement>('[data-select-schools]')!;
    const schools = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="school_id"]'));
    selectAll.checked = true;
    selectAll.dispatchEvent(new Event('change', { bubbles: true }));

    expect(schools.every((school) => school.checked)).toBe(true);
    expect(document.querySelector('[data-school-count]')).toHaveTextContent('2');
    expect(document.querySelector('[data-school-summary]')).toHaveTextContent('Cedar Valley Elementary · Port Susan Middle');
    expect(document.querySelector('[data-school-selection-names]')).toHaveTextContent('Cedar Valley Elementary, Port Susan Middle');

    document.querySelector<HTMLButtonElement>('[data-clear-schools]')!.click();
    expect(schools.every((school) => !school.checked)).toBe(true);
    expect(selectAll.checked).toBe(false);
    expect(document.querySelector('[data-school-summary]')).toHaveTextContent('Select schools');
  });

  it('updates the part price and total immediately when part or labor changes', () => {
    document.body.innerHTML = `
      <form data-replacement-form>
        <table><tbody><tr>
          <td><select data-part-select>
            <option data-default-cost="1500" selected>Water Fountain</option>
            <option data-default-cost="600">Tap/Sink</option>
          </select></td>
          <td><input data-unit-cost value="1500.00"></td>
        </tr></tbody></table>
        <input data-labor-cost value="0.00">
        <span data-material-total></span>
        <strong data-grand-total></strong>
      </form>
    `;
    runBudgetScript();

    const part = document.querySelector<HTMLSelectElement>('[data-part-select]')!;
    const cost = document.querySelector<HTMLInputElement>('[data-unit-cost]')!;
    const labor = document.querySelector<HTMLInputElement>('[data-labor-cost]')!;
    part.selectedIndex = 1;
    part.dispatchEvent(new Event('change', { bubbles: true }));

    expect(cost.value).toBe('600.00');
    expect(document.querySelector('[data-material-total]')).toHaveTextContent('$600.00');

    labor.value = '125.50';
    labor.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('[data-grand-total]')).toHaveTextContent('$725.50');
  });

  it('filters remediation schools by school name', () => {
    document.body.innerHTML = `
      <form data-school-form>
        <input type="search" data-school-search>
        <label class="school-option-row"><input type="checkbox" name="school_id" value="a" data-school-name="Cedar Valley Elementary"></label>
        <label class="school-option-row"><input type="checkbox" name="school_id" value="b" data-school-name="Port Susan Middle"></label>
        <p data-school-search-empty hidden>No schools found.</p>
      </form>
    `;
    runBudgetScript();

    const search = document.querySelector<HTMLInputElement>('[data-school-search]')!;
    const rows = Array.from(document.querySelectorAll<HTMLElement>('.school-option-row'));
    search.value = 'port susan';
    search.dispatchEvent(new Event('input', { bubbles: true }));

    expect(rows[0].hidden).toBe(true);
    expect(rows[1].hidden).toBe(false);
    expect(document.querySelector('[data-school-search-empty]')).not.toBeVisible();
  });
});
