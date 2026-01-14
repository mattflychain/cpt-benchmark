// CPT Checker App
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/24400971/ugkyxst/';

document.addEventListener('DOMContentLoaded', () => {
    const stateSelect = document.getElementById('state-select');
    const cptInput = document.getElementById('cpt-code');
    const billingInput = document.getElementById('billing-amount');
    const cptDescription = document.getElementById('cpt-description');
    const compareBtn = document.getElementById('compare-btn');
    const resultsSection = document.getElementById('results');
    const inputCard = document.querySelector('.input-card');
    const resetBtn = document.getElementById('reset-btn');

    // Email gate elements
    const emailModal = document.getElementById('email-modal');
    const emailForm = document.getElementById('email-form');
    const emailInput = document.getElementById('email-input');

    // Populate state dropdown
    // process_cpt_csv.py excludes WV and DC from the data, but we should also exclude them from the UI
    const EXCLUDED_STATES = ['WV', 'DC'];

    if (window.STATE_NAMES) {
        Object.entries(window.STATE_NAMES)
            .filter(([code]) => !EXCLUDED_STATES.includes(code)) // Filter out excluded states
            .sort((a, b) => a[1].localeCompare(b[1]))
            .forEach(([code, name]) => {
                const option = document.createElement('option');
                option.value = code;
                option.textContent = name;
                stateSelect.appendChild(option);
            });
    }

    let selectedState = null;
    let selectedCpt = null;

    // Email gate: Check if user has submitted email
    function hasUserEmail() {
        return localStorage.getItem('flychain_user_email') !== null;
    }

    // Email gate: Get analysis count
    function getAnalysisCount() {
        return parseInt(localStorage.getItem('flychain_analysis_count') || '0', 10);
    }

    // Email gate: Increment analysis count
    function incrementAnalysisCount() {
        const count = getAnalysisCount() + 1;
        localStorage.setItem('flychain_analysis_count', count.toString());
        return count;
    }

    // Send data to Zapier
    async function sendToZapier(email) {
        if (!ZAPIER_WEBHOOK_URL || ZAPIER_WEBHOOK_URL.includes('REPLACE_WITH_YOUR')) {
            console.warn('Zapier Webhook URL not configured.');
            return;
        }

        const payload = {
            email: email,
            timestamp: new Date().toISOString(),
            source: 'ABA Rate Benchmark Tool',
            state: selectedState,
            cptCode: selectedCpt,
            billingRate: billingInput.value,
            analysisCount: getAnalysisCount()
        };

        try {
            await fetch(ZAPIER_WEBHOOK_URL, {
                method: 'POST',
                mode: 'no-cors', // Use no-cors for simple webhooks if needed, though cors is better if Zapier supports it
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            console.log('Lead sent to Zapier successfully.');
        } catch (error) {
            console.error('Error sending lead to Zapier:', error);
        }
    }

    // Format currency
    function formatCurrency(amount) {
        return '$' + parseFloat(amount).toFixed(2);
    }

    // Helper for safe text updates
    function setSafeText(id, text) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = text;
        } else {
            console.warn(`Element with id "${id}" not found.`);
        }
    }

    // Validate form and enable button
    function validateForm() {
        const stateValid = selectedState !== null;
        const cptValid = selectedCpt !== null;
        const billingVal = parseFloat(billingInput.value);
        const billingValid = !isNaN(billingVal) && billingVal > 0;

        console.log('Form Validation:', {
            state: selectedState,
            cpt: selectedCpt,
            billing: billingInput.value,
            isValid: stateValid && cptValid && billingValid,
            checks: { stateValid, cptValid, billingValid }
        });

        compareBtn.disabled = !(stateValid && cptValid && billingValid);
    }

    // State select handler
    stateSelect.addEventListener('change', (e) => {
        selectedState = e.target.value;
        if (selectedState) {
            stateSelect.classList.add('valid');
        } else {
            stateSelect.classList.remove('valid');
        }
        validateForm();
    });

    // CPT code select handler
    cptInput.addEventListener('change', (e) => {
        selectedCpt = e.target.value;
        const data = window.ABA_DATA || {};
        if (selectedCpt && data[selectedCpt]) {
            cptDescription.textContent = data[selectedCpt].description;
            cptDescription.classList.add('visible');
            cptInput.classList.add('valid');
        } else {
            console.warn('Review: CPT Code not found in data:', selectedCpt);
            cptDescription.textContent = 'Select a valid code to see description.';
            cptDescription.classList.remove('visible');
            cptInput.classList.remove('valid');
            selectedCpt = null;
        }
        validateForm();
    });

    // Billing amount input handler
    billingInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/[^\d.]/g, '');
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        if (parts[1] && parts[1].length > 2) {
            value = parts[0] + '.' + parts[1].substring(0, 2);
        }
        e.target.value = value;
        validateForm();
    });

    // Compare button handler
    compareBtn.addEventListener('click', () => {
        if (compareBtn.disabled) return;

        const analysisCount = getAnalysisCount();
        console.log('Button Clicked. Count:', analysisCount, 'Email:', hasUserEmail());

        // Email gate: if second+ analysis and no email, show modal
        if (analysisCount >= 1 && !hasUserEmail()) {
            console.log('Email Gate Triggered');
            emailModal.classList.remove('hidden');
            return;
        }

        try {
            showResults();
            // Increment ONLY if showResults didn't throw
            incrementAnalysisCount();
        } catch (error) {
            console.error('Error in showResults:', error);
            alert('An error occurred during calculation. Error: ' + error.message);
        }
    });

    // Email form submission handler
    emailForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        if (email) {
            localStorage.setItem('flychain_user_email', email);
            emailModal.classList.add('hidden');
            sendToZapier(email); // Trigger Zapier push
            incrementAnalysisCount();
            try {
                showResults();
            } catch (error) {
                console.error('Error in showResults (after email):', error);
            }
        }
    });

    function showResults() {
        const data = window.ABA_DATA || {};
        const names = window.STATE_NAMES || {};

        console.log('Showing Results for:', selectedState, selectedCpt);

        if (!selectedState || !selectedCpt || !data[selectedCpt]) {
            console.error('Missing data for calculation:', { selectedState, selectedCpt, hasData: !!data[selectedCpt] });
            throw new Error('Data missing for selected CPT: ' + selectedCpt);
        }

        const stats = data[selectedCpt].percentiles[selectedState];
        const userRate = parseFloat(billingInput.value);
        const stateName = names[selectedState] || selectedState;

        if (!stats) {
            // Handle missing state data (e.g. WV, DC)
            console.warn('No percentile data for state:', selectedState);

            setSafeText('results-state', stateName);
            setSafeText('your-rate', formatCurrency(userRate));
            setSafeText('state-avg-value', 'N/A');

            const insightIcon = document.getElementById('insight-icon');
            const insightTitle = document.getElementById('insight-title');
            const insightText = document.getElementById('insight-text');

            if (insightIcon) insightIcon.textContent = '📍';
            if (insightTitle) insightTitle.textContent = 'Data Unavailable';
            if (insightText) insightText.textContent = `We do not have sufficient data for ${stateName} to provide a reliable benchmark for this code.`;

            // Hide gauge or show empty state
            const gaugeContainer = document.querySelector('.gauge-container');
            if (gaugeContainer) gaugeContainer.style.opacity = '0.5';

            inputCard.style.display = 'none';
            resultsSection.classList.remove('hidden');
            return;
        }

        const median = stats.p50;
        console.log('Benchmark Logic:', { userRate, median, stats });

        // Update results
        setSafeText('results-state', stateName);
        setSafeText('your-rate', formatCurrency(userRate));
        setSafeText('state-avg-value', formatCurrency(median));

        // Calculate gauge position - use p5 to p95 as the visual range
        // If outside this range, clamp to 2% or 98%
        const minVal = stats.p5 * 0.9;
        const maxVal = stats.p95 * 1.1;
        const range = maxVal - minVal;
        const position = Math.min(Math.max(((userRate - minVal) / range) * 100, 2), 98);

        const marker = document.getElementById('gauge-marker');
        const markerEmoji = document.getElementById('marker-emoji');

        setSafeText('gauge-max', formatCurrency(stats.p95));
        setSafeText('gauge-avg', `Median: ${formatCurrency(median)}`);
        setSafeText('gauge-min', formatCurrency(stats.p5));

        // Animate gauge
        if (marker) {
            setTimeout(() => {
                marker.style.left = position + '%';
            }, 100);
        }

        // Update insight
        const insightCard = document.getElementById('insight-card');
        const insightIcon = document.getElementById('insight-icon');
        const insightTitle = document.getElementById('insight-title');
        const insightText = document.getElementById('insight-text');

        // Get CTA elements
        const flychainCta = document.getElementById('flychain-cta');
        const ctaHeadline = document.getElementById('cta-headline');
        const ctaSubtext = document.getElementById('cta-subtext');
        const yourRateCard = document.querySelector('.comparison-card.your-rate');

        if (insightCard) insightCard.classList.remove('above', 'below', 'on-target');
        if (flychainCta) flychainCta.classList.remove('top-performer', 'needs-help');
        if (yourRateCard) yourRateCard.classList.remove('above', 'below', 'on-target');

        const gaugeContainer = document.querySelector('.gauge-container');
        if (gaugeContainer) gaugeContainer.style.opacity = '1';

        // Logic based on percentiles
        if (userRate >= stats.p75) {
            // Above 75th percentile - Top Performer
            if (insightCard) insightCard.classList.add('above');
            if (yourRateCard) yourRateCard.classList.add('above');
            if (insightIcon) insightIcon.textContent = '🚀';
            if (insightTitle) insightTitle.textContent = 'Top Performer';
            if (insightText) insightText.textContent = `Your rate is in the top tier (above 75th percentile) for ${stateName}. You are receiving premium reimbursement.`;

            // Emoji for marker
            if (markerEmoji) markerEmoji.textContent = '💎';

            // CTA for high billers
            if (flychainCta) flychainCta.classList.add('top-performer');
            if (ctaHeadline) ctaHeadline.textContent = "🚀 Leading rates deserve leading operations.";
            if (ctaSubtext) ctaSubtext.textContent = "Top-performing practices use Flychain's healthcare-specific accounting and CFO tools to protect their margins and automate financial reporting.";

        } else if (userRate < stats.p25) {
            // Below 25th percentile - Needs Improvement
            if (insightCard) insightCard.classList.add('below');
            if (yourRateCard) yourRateCard.classList.add('below');
            if (insightIcon) insightIcon.textContent = '📉';
            if (insightTitle) insightTitle.textContent = 'Below Market';
            if (insightText) insightText.textContent = `Your rate is in the lower tier (below 25th percentile) for ${stateName}. There is significant room for negotiation.`;

            // Emoji for marker
            if (markerEmoji) markerEmoji.textContent = '⚠️';

            // CTA for low billers
            if (flychainCta) flychainCta.classList.add('needs-help');
            if (ctaHeadline) ctaHeadline.textContent = `📊 Unlock higher reimbursement rates`;
            if (ctaSubtext) ctaSubtext.textContent = `Flychain's CFO Intelligence tools show you exactly where you're underpaid - so you can negotiate with real payer data.`;

        } else {
            // Between p25 and p75 - Market Competitive
            if (insightCard) insightCard.classList.add('on-target');
            if (yourRateCard) yourRateCard.classList.add('on-target');
            if (insightIcon) insightIcon.textContent = '✅';
            if (insightTitle) insightTitle.textContent = 'Market Competitive';
            if (insightText) insightText.textContent = `Your rate is aligned with the market (between 25th and 75th percentile) for ${stateName}.`;

            // Emoji for marker
            if (markerEmoji) markerEmoji.textContent = '🎯';

            // CTA for average billers
            if (ctaHeadline) ctaHeadline.textContent = "💡 Great rates. How's your cash flow?";
            if (ctaSubtext) ctaSubtext.textContent = "Even with competitive rates, generic accounting can mask inefficiencies. Flychain provides healthcare-specific financial clarity to keep your practice thriving.";
        }

        // Show results, hide input
        if (inputCard) inputCard.style.display = 'none';
        if (resultsSection) resultsSection.classList.remove('hidden');
    }

    // Reset button handler
    resetBtn.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        inputCard.style.display = 'flex';

        // Partial reset: keep state and CPT, clear billing amount
        // This allows them to check the same code again or just change the code/rate easily
        billingInput.value = '';

        // Ensure validation is run to update button state (it will likely be disabled if billing is empty)
        validateForm();

        // Reset gauge marker position for next run
        const marker = document.getElementById('gauge-marker');
        if (marker) marker.style.left = '50%';
    });
});
