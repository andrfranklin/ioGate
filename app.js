const NODE_RED_BASE_URL = "http://localhost:1880"; // ajuste p/ seu ambiente

const statusEl = document.getElementById("status");
const alertaEl = document.getElementById("alerta");
const btnOpen = document.getElementById("btn-open");
const btnClose = document.getElementById("btn-close");

function setStatus(msg) {
  statusEl.textContent = msg;
}

function showAlert(msg) {
  alertaEl.textContent = msg;
  alertaEl.style.display = "block";
}

function sendGateCommand(action) {
  if (!navigator.geolocation) {
    setStatus("Geolocalização não suportada neste navegador.");
    return;
  }

  setStatus("Obtendo localização...");

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const payload = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        action,
      };

      setStatus("Enviando comando para o servidor...");

      fetch(`${NODE_RED_BASE_URL}/gate/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then(async (res) => {
          const text = await res.text().catch(() => "");
          if (!res.ok) {
            throw new Error(text || "Erro ao enviar comando.");
          }
          return text || "Comando enviado com sucesso.";
        })
        // .then((msg) => {
        //   setStatus(msg);
        // })
        .catch((err) => {
          console.error(err);
          setStatus("Falha ao enviar comando: " + err.message);
        });
    },
    (err) => {
      console.error(err);
      setStatus("Erro ao obter localização: " + err.message);
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0,
    }
  );
}

// Eventos dos botões
btnOpen.addEventListener("click", () => sendGateCommand("open"));
btnClose.addEventListener("click", () => sendGateCommand("close"));

function connectSSE() {
  const url = `${NODE_RED_BASE_URL}/alerts/stream`;

  const sse = new EventSource(url);

  sse.onopen = () => {
    setStatus("Conectado para receber alertas em tempo real (SSE).");
  };

  sse.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "UNAUTHORIZED_OPEN") {
        showAlert(
          "ALERTA: Portão aberto sem autorização! (" +
            (new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "short",
            }).format(new Date(data.timestamp)) || "sem horário informado") +
            ")"
        );
      } else {
        console.log("Mensagem SSE:", data);
      }
    } catch (e) {
      console.warn("Mensagem SSE inválida:", event.data);
    }
  };

  //   sse.addEventListener("command", (event) => {
  //     console.log("Evento SSE 'command':", event);
  //     const data = JSON.parse(event.data);

  //     if (data.type === "COMMAND_RECEIVED") {
  //       setStatus(
  //         `SSE: comando '${data.action}' recebido. ` +
  //           `lat=${data.lat}, lng=${data.lng}, ts=${data.timestamp}`
  //       );
  //     }
  //   });

  sse.onerror = (err) => {
    console.error("Erro no SSE:", err);
    // Alguns navegadores reabrem automaticamente. Se precisar,
    // você pode fechar e recriar manualmente:
    // sse.close();
    // setTimeout(connectSSE, 5000);
  };
}

connectSSE();
