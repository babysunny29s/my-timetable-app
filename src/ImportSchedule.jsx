import { useMemo, useState } from "react"
import { supabase } from "./supabase"
import { extractPdfText, filterTextByCourseCodes } from "./pdfExtract"
import {
  collectWarnings,
  flattenParsedSessions,
  parseScheduleWithGemini,
} from "./geminiParse"
import "./ImportSchedule.css"

function parseCourseCodesInput(value) {
  return value
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
}

function ImportSchedule({ userId, existingLessons, onImported, onBack }) {
  const [file, setFile] = useState(null)
  const [codesInput, setCodesInput] = useState("IT6017, IT3090, IT6016")
  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [warnings, setWarnings] = useState([])
  const [rows, setRows] = useState([])
  const [parsedMeta, setParsedMeta] = useState(null)

  const selectedCount = useMemo(
    () => rows.filter((r) => r.selected).length,
    [rows]
  )

  async function handleAnalyze(event) {
    event.preventDefault()
    setError("")
    setWarnings([])
    setRows([])
    setParsedMeta(null)

    const codes = parseCourseCodesInput(codesInput)
    if (!file) {
      setError("Hãy chọn file PDF lịch học")
      return
    }
    if (codes.length === 0) {
      setError("Nhập ít nhất một mã học phần")
      return
    }

    setAnalyzing(true)

    try {
      const fullText = await extractPdfText(file)
      const filtered = filterTextByCourseCodes(fullText, codes)
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      const parsed = await parseScheduleWithGemini({
        filteredText: filtered,
        courseCodes: codes,
        apiKey,
      })

      const flat = flattenParsedSessions(parsed)
      setRows(flat)
      setWarnings(collectWarnings(parsed))
      setParsedMeta({
        term: parsed.term,
        term_start: parsed.term_start,
        term_end: parsed.term_end,
      })

      if (flat.length === 0) {
        setError(
          "Không trích được buổi học nào. Kiểm tra mã HP hoặc thử PDF khác."
        )
      }
    } catch (err) {
      console.error(err)
      setError(err.message || "Phân tích thất bại")
    } finally {
      setAnalyzing(false)
    }
  }

  function toggleRow(id) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, selected: !row.selected } : row
      )
    )
  }

  function toggleAll(selected) {
    setRows((prev) => prev.map((row) => ({ ...row, selected })))
  }

  async function handleSave() {
    const selected = rows.filter((r) => r.selected)
    if (selected.length === 0) {
      setError("Chọn ít nhất một buổi để lưu")
      return
    }

    setSaving(true)
    setError("")

    try {
      const existingKeys = new Set(
        (existingLessons || []).map(
          (l) => `${l.date}|${l.time}|${l.subject}|${l.room}`
        )
      )

      const payload = []
      let skipped = 0

      for (const row of selected) {
        const key = `${row.date}|${row.time}|${row.subject}|${row.room}`
        if (existingKeys.has(key)) {
          skipped += 1
          continue
        }
        payload.push({
          date: row.date,
          time: row.time,
          subject: row.subject,
          room: row.room,
          note: row.note || null,
          user_id: userId,
        })
      }

      if (payload.length === 0) {
        setError(
          skipped > 0
            ? "Tất cả buổi đã có trong lịch, không có gì mới để lưu."
            : "Không có buổi hợp lệ để lưu."
        )
        setSaving(false)
        return
      }

      const { data, error: insertError } = await supabase
        .from("lessons")
        .insert(payload)
        .select()

      if (insertError) throw insertError

      onImported?.(data || [], { skipped, saved: payload.length })
    } catch (err) {
      console.error(err)
      setError(err.message || "Lưu thất bại")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="import-panel">
      <div className="import-header">
        <div>
          <h2>Import lịch kỳ</h2>
          <p>
            Upload PDF nhà trường + mã học phần. Gemini trích buổi học, bạn
            xác nhận rồi mới lưu.
          </p>
        </div>
        {onBack && (
          <button type="button" className="import-back" onClick={onBack}>
            Về lịch
          </button>
        )}
      </div>

      <form className="import-form" onSubmit={handleAnalyze}>
        <label htmlFor="import-pdf">File PDF lịch học</label>
        <input
          id="import-pdf"
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />

        <label htmlFor="import-codes">Mã học phần (cách nhau bởi dấu phẩy)</label>
        <input
          id="import-codes"
          type="text"
          value={codesInput}
          onChange={(e) => setCodesInput(e.target.value)}
          placeholder="IT6017, IT3090, IT6016"
        />

        <button
          className="import-analyze"
          type="submit"
          disabled={analyzing}
        >
          {analyzing ? "Đang phân tích..." : "Phân tích PDF"}
        </button>
      </form>

      {error && <div className="import-alert error">{error}</div>}

      {parsedMeta && (parsedMeta.term || parsedMeta.term_start) && (
        <div className="import-meta">
          {parsedMeta.term && <span>Kỳ: {parsedMeta.term}</span>}
          {parsedMeta.term_start && parsedMeta.term_end && (
            <span>
              {parsedMeta.term_start} → {parsedMeta.term_end}
            </span>
          )}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="import-alert warn">
          <strong>Cảnh báo</strong>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <div className="import-review">
          <div className="import-review-toolbar">
            <span>
              {selectedCount}/{rows.length} buổi được chọn
            </span>
            <div className="import-review-actions">
              <button type="button" onClick={() => toggleAll(true)}>
                Chọn hết
              </button>
              <button type="button" onClick={() => toggleAll(false)}>
                Bỏ chọn
              </button>
            </div>
          </div>

          <div className="import-table-wrap">
            <table className="import-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Ngày</th>
                  <th>Giờ</th>
                  <th>Môn</th>
                  <th>Phòng</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className={row.selected ? "" : "dimmed"}>
                    <td>
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={() => toggleRow(row.id)}
                      />
                    </td>
                    <td>{row.date}</td>
                    <td>{row.time}</td>
                    <td>
                      <div className="import-subject">{row.subject}</div>
                      {row.note && (
                        <div className="import-note">{row.note}</div>
                      )}
                    </td>
                    <td>{row.room}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="import-save"
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
          >
            {saving
              ? "Đang lưu..."
              : `Lưu ${selectedCount} buổi vào lịch`}
          </button>
        </div>
      )}
    </section>
  )
}

export default ImportSchedule
