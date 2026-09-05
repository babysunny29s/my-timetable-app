import * as pdfjs from "pdfjs-dist"
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url"

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

function itemsToLines(items) {
  const rows = []

  for (const item of items) {
    if (!item.str || !item.str.trim()) continue
    const y = item.transform?.[5] ?? 0
    const x = item.transform?.[4] ?? 0
    const row = rows.find((r) => Math.abs(r.y - y) < 3.5)
    if (row) {
      row.parts.push({ x, text: item.str })
    } else {
      rows.push({ y, parts: [{ x, text: item.str }] })
    }
  }

  rows.sort((a, b) => b.y - a.y)

  return rows.map((row) => {
    row.parts.sort((a, b) => a.x - b.x)
    return row.parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim()
  })
}

/**
 * Trích toàn bộ text từ file PDF (browser), giữ theo dòng.
 */
export async function extractPdfText(file) {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const pages = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()
    const lines = itemsToLines(content.items)
    pages.push(`--- Trang ${pageNum} ---\n${lines.join("\n")}`)
  }

  return pages.join("\n\n")
}

/**
 * Giữ lại các đoạn quanh mã học phần để giảm token gửi Gemini.
 */
export function filterTextByCourseCodes(fullText, courseCodes) {
  const codes = courseCodes
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

  if (codes.length === 0) return fullText

  const lines = fullText.split(/\n/)
  const keptIndexes = new Set()
  const windowSize = 6

  for (let i = 0; i < lines.length; i += 1) {
    const upper = lines[i].toUpperCase()
    const hit = codes.some((code) => upper.includes(code))
    if (!hit) continue

    const start = Math.max(0, i - 1)
    const end = Math.min(lines.length - 1, i + windowSize)
    for (let j = start; j <= end; j += 1) {
      keptIndexes.add(j)
    }
  }

  let filtered = [...keptIndexes]
    .sort((a, b) => a - b)
    .map((i) => lines[i])
    .join("\n")

  if (filtered.length < 120) {
    const chunks = []
    for (const code of codes) {
      const re = new RegExp(`.{0,80}${code}.{0,600}`, "gi")
      const matches = fullText.match(re)
      if (matches) chunks.push(...matches)
    }
    filtered = chunks.join("\n---\n")
  }

  // Luôn kèm header kỳ nếu có trong file
  const headerMatch = fullText.match(/LỊCH HỌC KỲ[\s\S]{0,280}/i)
  if (headerMatch) {
    filtered = `${headerMatch[0]}\n\n${filtered}`
  }

  return filtered || fullText.slice(0, 12000)
}
