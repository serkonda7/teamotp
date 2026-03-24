const form = document.getElementById('add-form') as HTMLFormElement
const list = document.getElementById('codes-list') as HTMLUListElement

async function fetchCodes() {
	try {
		const response = await fetch('/api/otp')
		if (!response.ok) throw new Error('Failed to fetch')
		const codes = await response.json()

		list.innerHTML = ''
		if (!codes || codes.length === 0) {
			list.innerHTML = '<li>No codes found.</li>'
			return
		}

		codes.forEach((code: { issuer?: string; label: string }) => {
			const li = document.createElement('li')
			li.textContent = `${code.issuer}: ${code.label}`
			list.appendChild(li)
		})
	} catch (error) {
		console.error('Error fetching codes:', error)
		list.innerHTML = '<li>Error loading codes.</li>'
	}
}

if (form) {
	form.addEventListener('submit', async (e) => {
		e.preventDefault()

		const labelInput = document.getElementById('label') as HTMLInputElement
		const issuerInput = document.getElementById('issuer') as HTMLInputElement
		const secretInput = document.getElementById('secret') as HTMLInputElement

		const label = labelInput.value
		const issuer = issuerInput.value
		const secret = secretInput.value

		try {
			const response = await fetch('/api/otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ label, issuer, secret }),
			})

			if (response.ok) {
				form.reset()
				await fetchCodes()
			} else {
				const data = await response.json()
				alert(`Error: ${data.error || 'Unknown error'}`)
			}
		} catch (error) {
			console.error('Error adding code:', error)
			alert('An error occurred while adding the code.')
		}
	})
}

fetchCodes()
