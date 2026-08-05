import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const communicationStyles = readFileSync(
  'services/water-quality-reporter/static/app.css',
  'utf8',
);
const dropdownScript = readFileSync(
  'services/water-quality-reporter/static/school-picker.js',
  'utf8',
);

describe('Communication school dropdown', () => {
  it('opens, filters recommendations immediately, and supports multiple selections', () => {
    document.body.innerHTML = `
      <div class="school-multiselect" data-school-dropdown>
        <div class="school-combobox-search">
          <span class="school-combobox-selected" data-school-summary hidden></span>
          <input type="search" data-school-search aria-expanded="false">
        </div>
        <div data-school-menu>
          <span data-school-count>0 selected</span>
          <span data-school-result-count>2 schools</span>
          <input type="checkbox" data-school-select-all>
          <label class="school-picker-option" data-school-name="example elementary">
            <input type="checkbox" name="campus_ids" value="1"><span data-school-option-name>Example Elementary</span>
          </label>
          <label class="school-picker-option" data-school-name="example middle">
            <input type="checkbox" name="campus_ids" value="2"><span data-school-option-name>Example Middle</span>
          </label>
          <p data-school-search-empty hidden>No schools found.</p>
        </div>
      </div>
    `;

    window.eval(dropdownScript);

    const menu = document.querySelector<HTMLElement>('[data-school-menu]')!;
    const search = document.querySelector<HTMLInputElement>('[data-school-search]')!;
    const options = Array.from(document.querySelectorAll<HTMLElement>('.school-picker-option'));
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="campus_ids"]'));

    search.focus();
    expect(menu.hidden).toBe(false);
    expect(search.getAttribute('aria-expanded')).toBe('true');

    search.value = 'd';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(options[0].hidden).toBe(true);
    expect(options[1].hidden).toBe(false);
    expect(document.querySelector('[data-school-result-count]')?.textContent).toBe('1 school found');

    search.value = 'example elem';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    expect(options[0].hidden).toBe(false);
    expect(options[1].hidden).toBe(true);

    inputs[1].click();
    search.value = 'elem';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    inputs[0].click();

    expect(document.querySelector('[data-school-count]')?.textContent).toBe('2 selected');
    expect(search.value).toBe('');
    expect(document.querySelector('[data-school-summary]')?.textContent).toContain('Example Elementary');
    expect(document.querySelector('[data-school-summary]')?.textContent).toContain('Example Middle');
    expect(document.querySelector('[data-school-summary]')).not.toHaveAttribute('hidden');
    expect(document.querySelector('[data-school-summary]')?.closest('.school-combobox-search')).not.toBeNull();
    expect(communicationStyles).toContain('.school-combobox-selected');
    expect(communicationStyles).toContain('.school-multiselect:focus-within .school-dropdown-menu');
    expect(communicationStyles).toMatch(/\.school-dropdown-menu\s*{\s*display:\s*none;/);
    expect(communicationStyles).toContain('.school-combobox-search input[type="search"]');
  });
});
