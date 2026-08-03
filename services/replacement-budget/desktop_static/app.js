(() => {
  const searches = document.querySelectorAll('[data-district-search]')

  searches.forEach((container) => {
    const form = container.querySelector('form')
    const input = container.querySelector('input[name="q"]')
    const list = container.querySelector('[role="listbox"]')
    if (!form || !input || !list) return

    let suggestions = []
    let activeIndex = -1
    let requestTimer

    const close = () => {
      list.hidden = true
      input.setAttribute('aria-expanded', 'false')
      activeIndex = -1
    }

    const goToDistrict = (name) => {
      window.location.assign(`/results/${encodeURIComponent(name)}`)
    }

    const render = () => {
      list.replaceChildren()
      suggestions.forEach((name, index) => {
        const item = document.createElement('li')
        const button = document.createElement('button')
        button.type = 'button'
        button.setAttribute('role', 'option')
        button.setAttribute('aria-selected', String(index === activeIndex))
        if (index === activeIndex) button.className = 'active'
        button.textContent = name
        button.addEventListener('mousedown', (event) => event.preventDefault())
        button.addEventListener('click', () => goToDistrict(name))
        item.append(button)
        list.append(item)
      })
      list.hidden = suggestions.length === 0
      input.setAttribute('aria-expanded', String(suggestions.length > 0))
    }

    const loadSuggestions = async () => {
      try {
        const params = new URLSearchParams({ q: input.value, limit: '10' })
        const response = await fetch(`/api/districts/suggest?${params}`)
        if (!response.ok) throw new Error('Suggestions unavailable')
        const data = await response.json()
        suggestions = data.districts
        activeIndex = suggestions.length > 0 ? 0 : -1
        render()
      } catch {
        suggestions = []
        activeIndex = -1
        list.innerHTML = '<li class="suggestion-meta">Could not load suggestions.</li>'
        list.hidden = false
        input.setAttribute('aria-expanded', 'true')
      }
    }

    const scheduleSuggestions = () => {
      window.clearTimeout(requestTimer)
      requestTimer = window.setTimeout(loadSuggestions, 180)
    }

    input.addEventListener('input', scheduleSuggestions)
    input.addEventListener('focus', scheduleSuggestions)
    input.addEventListener('keydown', (event) => {
      if (list.hidden || suggestions.length === 0) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        activeIndex = (activeIndex + 1) % suggestions.length
        render()
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        activeIndex = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1
        render()
      } else if (event.key === 'Escape') {
        close()
      }
    })

    form.addEventListener('submit', (event) => {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        event.preventDefault()
        goToDistrict(suggestions[activeIndex])
      }
    })

    document.addEventListener('mousedown', (event) => {
      if (!container.contains(event.target)) close()
    })
  })
})()

(() => {
  const schoolForm = document.querySelector('[data-school-form]')
  if (schoolForm) {
    const inputs = Array.from(schoolForm.querySelectorAll('input[name="school_id"]'))
    const count = schoolForm.querySelector('[data-school-count]')
    const updateSchools = () => {
      inputs.forEach((input) => {
        const card = input.closest('.school-select-card')
        if (card) card.classList.toggle('is-selected', input.checked)
      })
      if (count) count.textContent = String(inputs.filter((input) => input.checked).length)
    }
    inputs.forEach((input) => input.addEventListener('change', updateSchools))
    updateSchools()
  }

  const fixtureForm = document.querySelector('[data-fixture-form]')
  if (fixtureForm) {
    const inputs = Array.from(fixtureForm.querySelectorAll('input[name="fixture_id"]'))
    const count = fixtureForm.querySelector('[data-fixture-count]')
    const updateFixtures = () => {
      if (count) count.textContent = String(inputs.filter((input) => input.checked).length)
    }
    inputs.forEach((input) => input.addEventListener('change', updateFixtures))
    const selectEligible = fixtureForm.querySelector('[data-select-eligible]')
    const clear = fixtureForm.querySelector('[data-clear-fixtures]')
    if (selectEligible) {
      selectEligible.addEventListener('click', () => {
        inputs.forEach((input) => {
          if (input.dataset.eligible === 'true') input.checked = true
        })
        updateFixtures()
      })
    }
    if (clear) {
      clear.addEventListener('click', () => {
        inputs.forEach((input) => { input.checked = false })
        updateFixtures()
      })
    }
    updateFixtures()
  }

  const replacementForm = document.querySelector('[data-replacement-form]')
  if (replacementForm) {
    const costInputs = Array.from(replacementForm.querySelectorAll('[data-unit-cost]'))
    const laborInput = replacementForm.querySelector('[data-labor-cost]')
    const materialOutput = replacementForm.querySelector('[data-material-total]')
    const grandOutput = replacementForm.querySelector('[data-grand-total]')
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

    const numericValue = (input) => {
      const value = Number.parseFloat(input?.value ?? '0')
      return Number.isFinite(value) && value >= 0 ? value : 0
    }

    const updateTotals = () => {
      const material = costInputs.reduce((sum, input) => sum + numericValue(input), 0)
      const labor = numericValue(laborInput)
      if (materialOutput) materialOutput.textContent = currency.format(material)
      if (grandOutput) grandOutput.textContent = currency.format(material + labor)
    }

    replacementForm.querySelectorAll('[data-part-select]').forEach((select) => {
      select.addEventListener('change', () => {
        const selected = select.options[select.selectedIndex]
        const row = select.closest('tr')
        const costInput = row?.querySelector('[data-unit-cost]')
        if (costInput && selected?.dataset.defaultCost) {
          costInput.value = Number.parseFloat(selected.dataset.defaultCost).toFixed(2)
        }
        updateTotals()
      })
    })
    costInputs.forEach((input) => input.addEventListener('input', updateTotals))
    if (laborInput) laborInput.addEventListener('input', updateTotals)
    updateTotals()
  }
})()
