const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcrypt');
const app = express();

app.use(cors()); 
app.use(express.json());

// app.post('/conta', (req, res) => {
//   const { cpf, nome } = req.body;
//   res.json({cpf,nome});
// });
app.get('/teste', (req, res) => {
  res.json({msg:"sucesso nosso banco está funcionando..."});
});

// ENDPOINT DE TESTE DE BANCO
app.get('/teste-db', (req, res) => {
  db.query('SELECT 1 + 1 AS teste', (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({
        conectado: false,
        erro: err.message
      });
    }
    res.json({
      conectado: true,
      msg: "Banco conectado!",
      resultado: rows[0]
    });
  });
});

// 2 - LOGIN SIMPLES (só por CPF)
app.post('/login', (req, res) => {
  const { cpf,senha } = req.body;
  
  db.query('SELECT * FROM contas WHERE cpf =?', [cpf], async(err, rows) => {
    if (rows.length === 0)return res.status(404).json({msg: "Conta não encontrada"});            
    
    const cliente = rows[0];
    
    const senhaCorreta = await bcrypt.compare(senha, cliente.senha_hash);

    if (!senhaCorreta) return res.status(401).json({ erro: "CPF ou Senha inválidas" });

    res.json({ msg: "Login ok", cliente: { id: cliente.id, nome: cliente.nome } });
  });
});

// Criando uma conta
app.post('/conta', async (req, res) => {
  const { cpf, nome,email,chave_pix, senha } = req.body;

  try {
    // 1. cria o hash (10 é o padrão)
    const senha_hash = await bcrypt.hash(senha, 10);

    // 2. salva o hash, não a senha
    db.query(
      'INSERT INTO contas (cpf, nome, email, chave_pix, senha_hash) VALUES (?,?,?,?,?)',
      [cpf, nome,email,chave_pix, senha_hash],
      (err) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.status(201).json({ msg: "Conta criada com sucesso!" });
      }
    );
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.listen(3000, () => console.log("Rodando na porta 3000"));