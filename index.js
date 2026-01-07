const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const axios = require("axios");

const app = express();
app.use(express.json());

// Banco SQLite
const db = new sqlite3.Database("gastos.db");

db.run(`
  CREATE TABLE IF NOT EXISTS transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo TEXT,
    valor REAL,
    categoria TEXT,
    data TEXT
  )
`);

// Configuração WhatsApp
const TOKEN = "X2X8du337XHQXW";       // Coloque seu token
const PHONE_ID = "911847880"; // Coloque seu Phone ID

function enviarWhatsApp(numero, texto) {
  axios.post(
    `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: numero,
      text: { body: texto },
    },
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  ).catch(err => console.log("Erro WhatsApp:", err.message));
}

// Webhook WhatsApp
app.post("/webhook", (req, res) => {
  const entry = req.body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;
  const message = value?.messages?.[0];

  if (!message || !message.text) return res.sendStatus(200);

  const texto = message.text.body.toLowerCase();
  const numero = message.from;

  const partes = texto.split(" ");
  const comando = partes[0];
  const valor = parseFloat(partes[1]);
  const categoria = partes.slice(2).join(" ") || "-";

  // Registrar gasto ou receita
  if (comando === "gasto" || comando === "receita") {
    if (isNaN(valor)) {
      enviarWhatsApp(numero, "❌ Valor inválido. Exemplo: gasto 50 mercado");
      return res.sendStatus(200);
    }

    const data = new Date().toLocaleDateString();

    db.run(
      `INSERT INTO transacoes (tipo, valor, categoria, data) VALUES (?, ?, ?, ?)`,
      [comando, valor, categoria, data],
      function(err) {
        if (err) {
          enviarWhatsApp(numero, "❌ Erro ao registrar: " + err.message);
        } else {
          enviarWhatsApp(numero, `✅ ${comando} de R$ ${valor} registrado!`);
        }
      }
    );
  }

  // Consultar saldo
  if (comando === "saldo") {
    db.all(
      `SELECT tipo, SUM(valor) total FROM transacoes GROUP BY tipo`,
      (err, rows) => {
        if (err) return enviarWhatsApp(numero, "❌ Erro ao calcular saldo");

        let receitas = 0;
        let gastos = 0;
        rows.forEach(r => {
          if (r.tipo === "receita") receitas = r.total;
          if (r.tipo === "gasto") gastos = r.total;
        });

        const saldo = receitas - gastos;
        enviarWhatsApp(numero, `💰 Saldo atual: R$ ${saldo.toFixed(2)}`);
      }
    );
  }

  res.sendStatus(200);
});

// Iniciar servidor
app.listen(3000, () => {
  console.log("🤖 Bot WhatsApp rodando na porta 3000");
});
