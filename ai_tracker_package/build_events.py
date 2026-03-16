def build_alerts():
    return [
        {
            "title": "NVDA platform language shifts toward next-gen compute intensity",
            "scope": "NVDA / TSM",
            "condition": "Trigger on Blackwell, Rubin, GPU scaling, compute intensity, accelerator demand, or next-gen platform language.",
            "action": "Raise compute platform priority and check upstream packaging/foundry readthrough.",
            "severity": "High"
        },
        {
            "title": "NVDA mentions context memory, KV cache, or memory hierarchy",
            "scope": "NVDA → SNDK / MU",
            "condition": "Trigger on context memory, KV cache, memory hierarchy, or AI-native storage language.",
            "action": "Raise storage / memory readthrough priority.",
            "severity": "High"
        },
        {
            "title": "MU highlights HBM shipments, pricing discipline, or gross margin",
            "scope": "MU / NVDA / TSM",
            "condition": "Trigger on HBM, DRAM, shipments, pricing discipline, margin expansion, or AI memory demand.",
            "action": "Raise memory sensitivity and update revenue / GM / EPS bridge.",
            "severity": "High"
        },
        {
            "title": "SNDK highlights design wins, SSD tiering, or flash inference relevance",
            "scope": "SNDK / MU / NVDA",
            "condition": "Trigger on design win, SSD, NAND, flash, context memory, storage tier, or inference storage language.",
            "action": "Raise storage-tier relevance and monitor commercialization timing.",
            "severity": "High"
        },
        {
            "title": "Networking language shifts toward scale-out or fabric bottlenecks",
            "scope": "ANET / MRVL / ALAB / CRDO",
            "condition": "Trigger on scale-out, network fabric, rack-scale, ethernet, interconnect, or bandwidth bottleneck language.",
            "action": "Raise networking cluster sensitivity and review NVDA readthrough.",
            "severity": "High"
        },
        {
            "title": "Optics language strengthens around optical interconnect or photonics",
            "scope": "LITE / COHR / CRDO / ANET",
            "condition": "Trigger on optics, optical interconnect, photonics, co-packaged optics, or optical scaling language.",
            "action": "Raise optics cluster priority and compare against networking bottleneck commentary.",
            "severity": "Medium"
        },
        {
            "title": "AI deployment highlights liquid cooling, thermal limits, or power constraints",
            "scope": "VRT / NVDA",
            "condition": "Trigger on liquid cooling, rack density, thermal bottleneck, power constraint, or data center power language.",
            "action": "Raise deployment bottleneck importance and monitor timing impact.",
            "severity": "High"
        },
        {
            "title": "Advanced packaging or foundry tightness reappears in AI supply chain",
            "scope": "TSM / NVDA / MU / COHR",
            "condition": "Trigger on advanced packaging, CoWoS, foundry, packaging capacity, yield, or supply tightness language.",
            "action": "Raise upstream constraint sensitivity and monitor shipment timing risk.",
            "severity": "High"
        },
        {
            "title": "Custom watchlist ticker has unusual price move without mapped event",
            "scope": "Custom Watchlist",
            "condition": "Trigger when a front-end temporary custom ticker shows a large move but no linked event intelligence exists.",
            "action": "Prompt manual review and add temporary analyst note into event feed.",
            "severity": "Medium"
        }
    ]
