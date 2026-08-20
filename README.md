# Equipment Financing Rate Data

Open, self-updating dataset of aggregate commercial equipment financing rate
and estimated monthly payment benchmarks, by category.

**Source:** [Equipment Capital Index](https://www.equipmentcapitalindex.com/press)
**Live figures & methodology:** https://www.equipmentcapitalindex.com/methodology
**License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — free to use, cite, or redistribute with attribution.

## What this is

[`data/rate-report.json`](data/rate-report.json) is a snapshot of estimated
commercial equipment financing APRs and monthly payments, aggregated across
hundreds of real, individually priced machines (construction, agriculture,
trucking, power equipment, material handling) tracked by Equipment Capital
Index. Figures are computed deterministically from real per-machine price
and rate data — not survey estimates or fabricated averages.

This repo exists so the data has a permanent, versioned, machine-readable
home outside the website itself — useful for researchers, journalists, or
anyone building on top of the numbers without scraping a webpage.

## Data shape

```json
{
  "generated_at": "2026-08-20T16:14:52.456Z",
  "data_as_of": "2026-08-19T08:57:15.128984+00:00",
  "source": "https://www.equipmentcapitalindex.com",
  "license": "https://creativecommons.org/licenses/by/4.0/",
  "total_machines_tracked": 349,
  "site_avg_apr_percent": 8.16,
  "site_avg_estimated_monthly_payment_usd": 2602,
  "categories": [
    {
      "category": "heavy-construction",
      "label": "Heavy Construction",
      "machines_tracked": 182,
      "avg_apr_percent": 8.25,
      "avg_estimated_monthly_payment_usd": 2635
    }
  ]
}
```

## Update frequency

A scheduled GitHub Action (`.github/workflows/update-data.yml`) regenerates
`data/rate-report.json` from the live source every 3 days and commits it if
the numbers changed. No manual maintenance.

## Citing this data

```
Equipment Capital Index, "Equipment Financing Rate Report"
https://www.equipmentcapitalindex.com/press
```

Attribution is appreciated, not required, under CC BY 4.0.

## Questions

contact@equipmentcapitalindex.com
