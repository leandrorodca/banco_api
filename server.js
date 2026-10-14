const express = require('express');
const cors = require('cors');
const db = require('./db');
const bcrypt = require('bcrypt');
const app = express();

app.use(cors()); 
app.use(express.json());

app.get('/v1/teste', (req, res) => {
  return res.json({msg:"Banco funcionando..."});
});

// ENDPOINT DE TESTE DE BASE DE DADOS
app.get('/v1/teste-db', (req, res) => {
  db.query('SELECT 1 + 1 AS teste', (err, rows) => {
    if (err) {
      console.log(err);
      return res.status(500).json({
        conectado: false,
        erro: err.message
      });
    }
    return res.json({
      conectado: true,
      msg: "Banco conectado!",
      resultado: rows[0]
    });
  });
});

// 2 - LOGIN SIMPLES (só por CPF)
app.post('/v1/login', (req, res) => {
  const { cpf,senha } = req.body;
  db.query('SELECT * FROM contas WHERE cpf =?', [cpf], async(err, rows) => {
    if (rows.length === 0)return res.status(404).json({msg: "Conta não encontrada"});            
    
    const cliente = rows[0];
    
    const senhaCorreta = await bcrypt.compare(senha, cliente.senha_hash);

    if (!senhaCorreta) return res.status(401).json({ erro: "CPF ou Senha inválidos" });

    return res.json({ msg: true, cliente: { id: cliente.id, nome: cliente.nome } });
  });
 
});

// Criando uma conta
app.post('/v1/conta', async (req, res) => {
  const { cpf, nome,email,chave_pix, senha } = req.body;
console.log(cpf, nome, email,senha, chave_pix)
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
   return res.status(500).json({ erro: e.message });
  }
});
// 3 - CONSULTAR SALDO
app.get('/v1/saldo/:cpf', (req, res) => {
  const {cpf} = req.params
  db.query('SELECT nome ,saldo FROM contas WHERE cpf =?', [cpf], (err, rows) => {
   
    return res.json(rows[0]);
  });
});

// 4 - TRANSFERIR COM ROLLBACK
app.post('/v1/transferir', (req, res) => {
  const { origem_id, destino_id, valor } = req.body;

  // pega uma conexão dedicada do pool
  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ erro: err.message });

    conn.beginTransaction(err => {
      if (err) {
        conn.release();
        return res.status(500).json({ erro: err.message });
      }

      // 1. verifica origem
      conn.query('SELECT * FROM contas WHERE cpf =? FOR UPDATE', [origem_id], (err, rowsOrigem) => {
        if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ erro: err.message }); });
        if (rowsOrigem.length === 0) return conn.rollback(() => { conn.release(); res.status(404).json({msg: "Conta origem não encontrada"}); });

        conn.query('SELECT * FROM contas WHERE cpf =? FOR UPDATE', [destino_id], (err, rowsDestino) => {
          if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ erro: err.message }); });
          if (rowsDestino.length === 0) return conn.rollback(() => { conn.release(); res.status(404).json({msg: "Conta destino não encontrada"}); });

          if (rowsOrigem[0].saldo < valor) {
            return conn.rollback(() => { conn.release(); res.status(400).json({ msg: "Saldo insuficiente" }); });
          }


          conn.query('UPDATE contas SET saldo = saldo -? WHERE cpf =?', [valor, origem_id], (err) => {
            if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ erro: err.message }); });

            conn.query('UPDATE contas SET saldo = saldo +? WHERE cpf =?', [valor, destino_id], (err) => {
              if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ erro: err.message }); });

              conn.query('INSERT INTO transacoes (origem_id, destino_id, tipo, valor) VALUES (?,?, "transferencia",?)',
                [origem_id, destino_id, valor], (err) => {
                  if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ erro: err.message }); });

                  // SE CHEGOU AQUI, TUDO DEU CERTO
                  conn.commit(err => {
                    if (err) return conn.rollback(() => { conn.release(); res.status(500).json({ erro: err.message }); });
                    conn.release();
                    return res.json({msg: "Transferência realizada com sucesso"});
                  });
                });
            });
          });
        });
      });
    });
  });
});
app.listen(3000, () => console.log("Rodando na porta 3000"));