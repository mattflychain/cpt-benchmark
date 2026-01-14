import csv
import json
import os

# Configuration
INPUT_FILE = 'cleaned_data.csv'
OUTPUT_FILE = 'data/aba-data.js'
EXCLUDED_STATES = ['WV', 'DC']

# CPT Descriptions map (maintained from previous file content)
CPT_DESCRIPTIONS = {
    "97151": "Behavior Identification Assessment (per 15 min)",
    "97152": "Behavior Identification Support Assessment (per 15 min)",
    "97153": "Adaptive Behavior Treatment by Protocol (Direct 1:1) (per 15 min)",
    "97154": "Group Adaptive Behavior Treatment by Protocol (per 15 min)",
    "97155": "Adaptive Behavior Treatment with Protocol Modification (Supervision) (per 15 min)",
    "97156": "Family Adaptive Behavior Treatment Guidance (Parent Training) (per 15 min)",
    "97157": "Multiple-family Group Adaptive Behavior Treatment Guidance (per 15 min)",
    "97158": "Group Adaptive Behavior Treatment with Protocol Modification (per 15 min)"
}

def parse_currency(value):
    """Clean currency string property."""
    if not value:
        return 0.0
    return float(value.replace('$', '').replace(',', '').strip())

def main():
    aba_data = {}

    # Initialize structure
    for code, desc in CPT_DESCRIPTIONS.items():
        aba_data[code] = {
            "description": desc,
            "percentiles": {}
        }

    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                cpt = row['CPT Code'].strip()
                state = row['State'].strip()
                
                # Filter exclusions
                if state in EXCLUDED_STATES:
                    continue
                
                if cpt not in aba_data:
                    # Should theoretically not happen if mapped correctly, but just in case
                    continue

                # Parse percentiles
                percentiles = {
                    "p5": parse_currency(row['5th %ile']),
                    "p10": parse_currency(row['10th %ile']),
                    "p25": parse_currency(row['25th %ile']),
                    "p50": parse_currency(row['50th %ile']),
                    "p75": parse_currency(row['75th %ile']),
                    "p90": parse_currency(row['90th %ile']),
                    "p95": parse_currency(row['95th %ile'])
                }

                aba_data[cpt]["percentiles"][state] = percentiles

        # Generate JS file content
        js_content = "/**\n"
        js_content += " * ABA Industry Benchmark Data (Generated)\n"
        js_content += " * Source: cleaned_data.csv\n"
        js_content += " */\n"
        js_content += "const ABA_BENCHMARKS = " + json.dumps(aba_data, indent=4) + ";\n\n"
        js_content += "// Export it globally\n"
        js_content += "window.ABA_DATA = ABA_BENCHMARKS;\n"

        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(js_content)
        
        print(f"Successfully generated {OUTPUT_FILE}")

    except Exception as e:
        print(f"Error processing data: {e}")

if __name__ == '__main__':
    main()
