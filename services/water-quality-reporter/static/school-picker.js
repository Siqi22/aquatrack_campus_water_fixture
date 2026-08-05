(() => {
  const search = document.querySelector('[data-school-search]');
  const dropdown = document.querySelector('[data-school-dropdown]');
  const menu = document.querySelector('[data-school-menu]');
  if (!search || !dropdown || !menu) return;

  const options = Array.from(dropdown.querySelectorAll('.school-picker-option'));
  const inputs = Array.from(dropdown.querySelectorAll('input[name="campus_ids"]'));
  const selectAll = dropdown.querySelector('[data-school-select-all]');
  const count = dropdown.querySelector('[data-school-count]');
  const resultCount = dropdown.querySelector('[data-school-result-count]');
  const summary = dropdown.querySelector('[data-school-summary]');
  const empty = dropdown.querySelector('[data-school-search-empty]');

  const normalizeSearch = (value) => String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();

  const updateSelection = () => {
    const selectedInputs = inputs.filter((input) => input.checked);
    const selectedNames = selectedInputs
      .map((input) => input.closest('.school-picker-option')?.querySelector('[data-school-option-name]')?.textContent?.trim())
      .filter(Boolean);

    if (count) count.textContent = `${selectedInputs.length} selected`;
    if (summary) {
      summary.textContent = selectedNames.join(' · ');
      summary.title = selectedNames.join(', ');
      summary.hidden = selectedNames.length === 0;
    }
    dropdown.classList.toggle('has-selection', selectedNames.length > 0);
    if (selectAll) {
      selectAll.checked = inputs.length > 0 && selectedInputs.length === inputs.length;
      selectAll.indeterminate = selectedInputs.length > 0 && selectedInputs.length < inputs.length;
    }
    options.forEach((option) => {
      const input = option.querySelector('input[name="campus_ids"]');
      option.setAttribute('aria-selected', input?.checked ? 'true' : 'false');
    });
  };

  const openDropdown = () => {
    search.setAttribute('aria-expanded', 'true');
    dropdown.classList.add('is-open');
  };

  const closeDropdown = () => {
    search.setAttribute('aria-expanded', 'false');
    dropdown.classList.remove('is-open');
  };

  const filterSchools = () => {
    dropdown.classList.toggle('is-searching', normalizeSearch(search.value).length > 0);
    const terms = normalizeSearch(search.value).split(/\s+/).filter(Boolean);
    let visible = 0;

    options.forEach((option) => {
      const schoolName = normalizeSearch(
        option.dataset.schoolName
        || option.querySelector('[data-school-option-name]')?.textContent
        || '',
      );
      const matches = terms.every((term) => schoolName.includes(term));
      option.hidden = !matches;
      if (matches) visible += 1;
    });

    if (empty) empty.hidden = visible > 0;
    if (resultCount) {
      resultCount.textContent = `${visible} school${visible === 1 ? '' : 's'} found`;
    }
  };

  const showMatchingSchools = () => {
    openDropdown();
    filterSchools();
  };

  search.addEventListener('focus', showMatchingSchools);
  search.addEventListener('click', showMatchingSchools);
  search.addEventListener('input', showMatchingSchools);
  search.addEventListener('keyup', showMatchingSchools);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      showMatchingSchools();
      options.find((option) => !option.hidden)
        ?.querySelector('input[name="campus_ids"]')
        ?.focus();
    }
  });

  inputs.forEach((input) => input.addEventListener('change', () => {
    search.value = '';
    filterSchools();
    updateSelection();
  }));
  selectAll?.addEventListener('change', () => {
    inputs.forEach((input) => {
      if (!input.closest('.school-picker-option')?.hidden) {
        input.checked = selectAll.checked;
      }
    });
    updateSelection();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!dropdown.contains(event.target)) closeDropdown();
  });
  dropdown.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeDropdown();
      search.focus();
    }
  });

  filterSchools();
  updateSelection();
})();
