export const brl = (n) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dois = (n) => String(n).padStart(2, '0')
export const ymd = (d) => { const x = new Date(d); return `${x.getFullYear()}-${dois(x.getMonth() + 1)}-${dois(x.getDate())}` }
export const hora = (d) => { const x = new Date(d); return `${dois(x.getHours())}:${dois(x.getMinutes())}` }
export const paraInput = (d) => `${ymd(d)}T${hora(d)}`
export const dataBR = (s) => (s ? s.slice(0, 10).split('-').reverse().join('/') : '')
