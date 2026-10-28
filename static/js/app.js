
const pages = {
    dashboard: "Dashboard",
    prediction: "Prédiction individuelle",
    batch: "Scoring CSV",
    model: "Performance du modèle",
    about: "À propos"
};

const root = document.documentElement;
const sidebar = document.getElementById("sidebar");
const mobileMenu = document.getElementById("mobileMenu");
const themeToggle = document.getElementById("themeToggle");
const pageTitle = document.getElementById("pageTitle");
const toast = document.getElementById("toast");

function navigate(pageName) {
    document.querySelectorAll(".page").forEach(page => {
        page.classList.remove("active");
    });

    document.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item.dataset.page === pageName);
    });

    const page = document.getElementById(`page-${pageName}`);
    if (page) {
        page.classList.add("active");
        pageTitle.textContent = pages[pageName] || "ChurnGuard";
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    sidebar.classList.remove("open");
}

document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => navigate(item.dataset.page));
});

document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => navigate(button.dataset.go));
});

mobileMenu.addEventListener("click", () => {
    sidebar.classList.toggle("open");
});

const savedTheme = localStorage.getItem("churn-theme") || "dark";
root.dataset.theme = savedTheme;
themeToggle.textContent = savedTheme === "dark" ? "☀" : "☾";

themeToggle.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = nextTheme;
    localStorage.setItem("churn-theme", nextTheme);
    themeToggle.textContent = nextTheme === "dark" ? "☀" : "☾";
});

function showToast(message, type = "normal") {
    toast.textContent = message;
    toast.classList.toggle("error", type === "error");
    toast.classList.add("show");

    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 4200);
}


// ------------------------------------------------------------
// Prediction form behavior
// ------------------------------------------------------------

const form = document.getElementById("predictionForm");
const tenure = document.getElementById("tenure");
const tenureOutput = document.getElementById("tenureOutput");
const phoneService = document.getElementById("phoneService");
const multipleLines = document.getElementById("multipleLines");
const internetService = document.getElementById("internetService");
const internetDependent = [...document.querySelectorAll(".internet-dependent")];
const predictButton = document.getElementById("predictButton");

tenure.addEventListener("input", () => {
    tenureOutput.value = `${tenure.value} mois`;
});

function syncPhoneFields() {
    const noPhone = phoneService.value === "No";
    multipleLines.disabled = noPhone;

    if (noPhone) {
        if (![...multipleLines.options].some(opt => opt.value === "No phone service")) {
            const option = document.createElement("option");
            option.value = "No phone service";
            option.textContent = "No phone service";
            multipleLines.appendChild(option);
        }
        multipleLines.value = "No phone service";
    } else {
        [...multipleLines.options].forEach(opt => {
            if (opt.value === "No phone service") opt.remove();
        });
        if (!["No", "Yes"].includes(multipleLines.value)) {
            multipleLines.value = "No";
        }
    }
}

function syncInternetFields() {
    const noInternet = internetService.value === "No";

    internetDependent.forEach(field => {
        const select = field.querySelector("select");
        field.classList.toggle("disabled", noInternet);
        select.disabled = noInternet;

        if (noInternet) {
            if (![...select.options].some(opt => opt.value === "No internet service")) {
                const option = document.createElement("option");
                option.value = "No internet service";
                option.textContent = "No internet service";
                select.appendChild(option);
            }
            select.value = "No internet service";
        } else {
            [...select.options].forEach(opt => {
                if (opt.value === "No internet service") opt.remove();
            });
            if (!["No", "Yes"].includes(select.value)) {
                select.value = "No";
            }
        }
    });
}

phoneService.addEventListener("change", syncPhoneFields);
internetService.addEventListener("change", syncInternetFields);

syncPhoneFields();
syncInternetFields();

function formToPayload() {
    // Les champs disabled ne sont pas inclus dans FormData,
    // donc on reconstitue explicitement les valeurs dépendantes.
    const data = Object.fromEntries(new FormData(form).entries());

    data.SeniorCitizen = Number(data.SeniorCitizen);
    data.tenure = Number(data.tenure);
    data.MonthlyCharges = Number(data.MonthlyCharges);
    data.TotalCharges = Number(data.TotalCharges);

    if (phoneService.value === "No") {
        data.MultipleLines = "No phone service";
    }

    if (internetService.value === "No") {
        [
            "OnlineSecurity",
            "OnlineBackup",
            "DeviceProtection",
            "TechSupport",
            "StreamingTV",
            "StreamingMovies"
        ].forEach(field => {
            data[field] = "No internet service";
        });
    }

    return data;
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    predictButton.classList.add("is-loading");
    predictButton.disabled = true;

    try {
        const response = await fetch("/api/predict", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(formToPayload())
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Erreur de prédiction.");
        }

        renderPrediction(data);
        showToast("Prédiction calculée avec succès.");
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        predictButton.classList.remove("is-loading");
        predictButton.disabled = false;
    }
});

function renderPrediction(data) {
    const placeholder = document.getElementById("resultPlaceholder");
    const card = document.getElementById("resultCard");
    const gauge = document.getElementById("riskGauge");
    const probabilityValue = document.getElementById("probabilityValue");
    const riskBadge = document.getElementById("riskBadge");
    const decisionValue = document.getElementById("decisionValue");
    const recommendationText = document.getElementById("recommendationText");

    placeholder.classList.add("hidden");
    card.classList.remove("hidden");

    const percent = Math.max(0, Math.min(100, data.probability_percent));
    const degrees = percent * 3.6;

    let gaugeColor = "#38d996";
    if (data.risk_level === "Modéré") gaugeColor = "#f6b84a";
    if (data.risk_level === "Élevé") gaugeColor = "#ff6376";

    gauge.style.setProperty("--progress", `${degrees}deg`);
    gauge.style.setProperty("--gauge-color", gaugeColor);

    probabilityValue.textContent = `${percent.toFixed(1)}%`;
    riskBadge.textContent = `Risque ${data.risk_level.toLowerCase()}`;
    riskBadge.className = "risk-badge";

    if (data.risk_level === "Faible") riskBadge.classList.add("risk-low");
    if (data.risk_level === "Modéré") riskBadge.classList.add("risk-medium");
    if (data.risk_level === "Élevé") riskBadge.classList.add("risk-high");

    decisionValue.textContent = data.decision === "Yes" ? "Churn probable" : "Rétention probable";
    recommendationText.textContent = data.recommendation;

    renderDrivers("positiveDrivers", data.drivers_positive, true);
    renderDrivers("negativeDrivers", data.drivers_negative, false);
}

function renderDrivers(containerId, rows, positive) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";

    if (!rows || rows.length === 0) {
        const empty = document.createElement("div");
        empty.className = "driver-item";
        empty.innerHTML = "<strong>Aucun facteur disponible</strong><span>—</span>";
        container.appendChild(empty);
        return;
    }

    rows.forEach(row => {
        const item = document.createElement("div");
        item.className = "driver-item";

        const contribution = Number(row.contribution);
        const signed = contribution > 0 ? `+${contribution.toFixed(3)}` : contribution.toFixed(3);

        item.innerHTML = `
            <strong title="${escapeHtml(row.feature)}">${escapeHtml(row.feature)}</strong>
            <span>${positive ? "Contribution +" : "Contribution "}${signed}</span>
        `;

        container.appendChild(item);
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}


// ------------------------------------------------------------
// Batch scoring
// ------------------------------------------------------------

const batchForm = document.getElementById("batchForm");
const csvFile = document.getElementById("csvFile");
const dropZone = document.getElementById("dropZone");
const fileName = document.getElementById("fileName");
const batchButton = document.getElementById("batchButton");
const batchResults = document.getElementById("batchResults");
const downloadCsv = document.getElementById("downloadCsv");

let latestCsvText = "";

csvFile.addEventListener("change", () => {
    fileName.textContent = csvFile.files[0]?.name || "Aucun fichier sélectionné";
});

["dragenter", "dragover"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.add("drag-over");
    });
});

["dragleave", "drop"].forEach(eventName => {
    dropZone.addEventListener(eventName, event => {
        event.preventDefault();
        dropZone.classList.remove("drag-over");
    });
});

dropZone.addEventListener("drop", event => {
    const file = event.dataTransfer.files[0];

    if (file && file.name.toLowerCase().endsWith(".csv")) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        csvFile.files = transfer.files;
        fileName.textContent = file.name;
    } else {
        showToast("Veuillez sélectionner un fichier CSV.", "error");
    }
});

batchForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!csvFile.files[0]) {
        showToast("Sélectionnez d'abord un fichier CSV.", "error");
        return;
    }

    batchButton.disabled = true;
    batchButton.textContent = "Scoring en cours...";

    try {
        const data = new FormData();
        data.append("file", csvFile.files[0]);

        const response = await fetch("/api/predict-batch", {
            method: "POST",
            body: data
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Le scoring a échoué.");
        }

        renderBatch(result);
        showToast("Scoring terminé avec succès.");
    } catch (error) {
        showToast(error.message, "error");
    } finally {
        batchButton.disabled = false;
        batchButton.textContent = "Lancer le scoring";
    }
});

function renderBatch(result) {
    batchResults.classList.remove("hidden");

    document.getElementById("batchTotal").textContent = result.summary.total;
    document.getElementById("batchRisk").textContent = result.summary.at_risk;
    document.getElementById("batchRate").textContent = `${result.summary.alert_rate.toFixed(1)}%`;
    document.getElementById("batchAverage").textContent = `${result.summary.average_probability.toFixed(1)}%`;

    latestCsvText = result.csv;

    const table = document.getElementById("batchTable");
    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");

    thead.innerHTML = "";
    tbody.innerHTML = "";

    if (!result.preview || result.preview.length === 0) {
        return;
    }

    const priorityColumns = [
        "customerID",
        "tenure",
        "Contract",
        "InternetService",
        "MonthlyCharges",
        "Churn_Probability",
        "Churn_Prediction",
        "Risk_Level"
    ];

    const allColumns = Object.keys(result.preview[0]);
    const columns = [
        ...priorityColumns.filter(column => allColumns.includes(column)),
        ...allColumns.filter(column => !priorityColumns.includes(column))
    ].slice(0, 10);

    const headerRow = document.createElement("tr");

    columns.forEach(column => {
        const th = document.createElement("th");
        th.textContent = column;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);

    result.preview.forEach(row => {
        const tr = document.createElement("tr");

        columns.forEach(column => {
            const td = document.createElement("td");
            let value = row[column];

            if (column === "Churn_Probability" && value !== null && value !== undefined) {
                value = `${(Number(value) * 100).toFixed(1)}%`;
            }

            td.textContent = value ?? "";
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    batchResults.scrollIntoView({ behavior: "smooth", block: "start" });
}

downloadCsv.addEventListener("click", () => {
    if (!latestCsvText) return;
    const BOM = "\uFEFF";

    const blob = new Blob(
        [BOM + latestCsvText],
        {
            type: "text/csv;charset=utf-8;"
        }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "churn_predictions.csv";

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
});
