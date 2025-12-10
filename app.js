const NODE_RED_BASE_URL = "http://localhost:1880"; // ajuste p/ seu ambiente

const statusEl = document.getElementById("status");
const alertaEl = document.getElementById("alerta");
const btnOpen = document.getElementById("btn-open");
const btnClose = document.getElementById("btn-close");
const headerP = document.querySelector("header p");

let currentLocation = null;

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? "var(--danger-color)" : "var(--text-color)";
}

function showAlert(msg) {
  alertaEl.textContent = msg;
  alertaEl.style.display = "block";
}

function updateUI(hasLocation) {
  btnOpen.disabled = !hasLocation;
  btnClose.disabled = !hasLocation;
  if (hasLocation) {
    headerP.textContent = "Localização obtida. Controles prontos para uso.";
  } else {
    headerP.textContent = "Aguardando sinal de GPS para liberar os controles.";
  }
}

function initializeLocation() {
  if (!navigator.geolocation) {
    setStatus("Geolocalização não é suportada neste navegador.", true);
    updateUI(false);
    return;
  }

  setStatus("Aguardando permissão de localização...");

  navigator.geolocation.watchPosition(
    (pos) => {
      currentLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      if (btnOpen.disabled) {
        setStatus("Localização obtida com sucesso!");
        updateUI(true);
      }
    },
    (err) => {
      console.error(err);
      setStatus(`Erro: ${err.message}`, true);
      updateUI(false);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    }
  );
}

function sendGateCommand(action) {
  if (!currentLocation) {
    setStatus("Localização indisponível. Não é possível enviar o comando.", true);
    return;
  }

  const actionText = action === "open" ? "Abrindo" : "Fechando";
  setStatus(`${actionText} o portão...`);
  // Disable buttons while command is in progress
  btnOpen.disabled = true;
  btnClose.disabled = true;


  fetch(`${NODE_RED_BASE_URL}/gate/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...currentLocation, action }),
  })
    .then(async (res) => {
      const text = await res.text().catch(() => "");
      if (!res.ok) {
        throw new Error(text || "Erro desconhecido do servidor.");
      }
      setStatus(`Comando de ${action} enviado com sucesso!`);
    })
    .catch((err) => {
      console.error(err);
      setStatus(`Falha no comando: ${err.message}`, true);
    })
    .finally(() => {
        // Re-enable buttons after command is complete
        updateUI(true);
    });
}

// Eventos dos botões
btnOpen.addEventListener("click", () => sendGateCommand("open"));
btnClose.addEventListener("click", () => sendGateCommand("close"));

function connectSSE() {
  const url = `${NODE_RED_BASE_URL}/alerts/stream`;
  const sse = new EventSource(url);

  sse.onopen = () => {
    console.log("Conectado ao SSE para alertas.");
  };

  sse.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "UNAUTHORIZED_OPEN") {
        showAlert(
          `ALERTA: Portão aberto sem autorização! (${new Intl.DateTimeFormat(
            "pt-BR",
            {
              dateStyle: "short",
              timeStyle: "short",
            }
          ).format(new Date(data.timestamp))})`
        );
      } else {
        console.log("Mensagem SSE:", data);
      }
    } catch (e) {
      console.warn("Mensagem SSE inválida:", event.data);
    }
  };

  sse.onerror = (err) => {
    console.error("Erro no SSE:", err);
  };
}

// Initialize
updateUI(false);
initializeLocation();
connectSSE();
