import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const CAMPOS = [
  { k: 'nome', l: 'Nome do estúdio', req: true },
  { k: 'responsavel', l: 'Responsável' },
  { k: 'telefone', l: 'Telefone / WhatsApp', type: 'tel' },
  { k: 'instagram', l: 'Instagram' },
  { k: 'endereco', l: 'Endereço' },
  { k: 'cidade', l: 'Cidade' },
  { k: 'chave_pix', l: 'Chave Pix' },
  { k: 'horario', l: 'Horário de atendimento', type: 'area' },
  { k: 'observacoes', l: 'Observações', type: 'area' },
]

export default function Estudio({ onVoltar, onSalvo }) {
  const [v, setV] = useState(null)
  const [erro, setErro] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('estudio').select('*').eq('id', 1).maybeSingle().then(({ data, error }) => {
      if (error) return setErro('Não foi possível carregar: ' + error.message)
      setV(data || { nome: 'Studio Nails' })
    })
  }, [])

  async function salvar(e) {
    e.preventDefault()
    setBusy(true); setErro(''); setOk(false)
    const { id, atualizado_em, ...resto } = v
    const dados = Object.fromEntries(Object.entries(resto).map(([k, x]) => [k, typeof x === 'string' ? x.trim() || null : x]))
    dados.nome = dados.nome || 'Studio Nails'
    const { error } = await supabase.from('estudio').upsert({ id: 1, ...dados, atualizado_em: new Date().toISOString() })
    setBusy(false)
    if (error) return setErro('Não foi possível salvar: ' + error.message)
    setOk(true)
    onSalvo(dados.nome)
  }

  if (!v) return erro ? <p className="erro">{erro}</p> : <p className="vazio">Carregando…</p>
  return (
    <section>
      <form onSubmit={salvar}>
        <h2>Meu estúdio</h2>
        <p className="contagem">Essas informações ficam guardadas só para você. O nome aparece no topo do sistema.</p>
        {CAMPOS.map((c) => (
          <label key={c.k}>{c.l}
            {c.type === 'area'
              ? <textarea rows="3" value={v[c.k] ?? ''} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />
              : <input type={c.type || 'text'} required={c.req} value={v[c.k] ?? ''} onChange={(e) => setV({ ...v, [c.k]: e.target.value })} />}
          </label>
        ))}
        {erro && <p className="erro">{erro}</p>}
        {ok && <p className="ok">Salvo ✓</p>}
        <div className="acoes">
          <button type="button" onClick={onVoltar}>Voltar</button>
          <button className="primario" disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>
    </section>
  )
}
