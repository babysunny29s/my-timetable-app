import { GoogleGenerativeAI } from "@google/generative-ai"

const SYSTEM_PROMPT = `Bạn là trợ lý trích xuất lịch học từ văn bản PDF thời khóa biểu đại học Việt Nam (HUST/SoICT).

Nhiệm vụ:
- Chỉ lấy các học phần có mã nằm trong danh sách người dùng cung cấp (khớp phần đầu mã, ví dụ IT3090 khớp IT3090-1-26).
- Bung mọi buổi học thành từng session cụ thể (mỗi ngày một object).
- Nếu lịch viết "thứ X hàng tuần từ A đến B", hãy liệt kê từng ngày trong khoảng.
- Năm mặc định lấy từ ngữ cảnh kỳ (ví dụ 2026). Ngày dạng d/m hoặc d/m/yyyy.
- Giờ chuẩn hóa HH:mm (24h). "17h30" = "17:30".
- Nếu thiếu ngày/giờ rõ ràng (Project, GV bố trí sau...), để sessions=[] và ghi warnings.
- Không bịa ngày không có trong văn bản.

Trả về ĐÚNG một JSON object (không markdown), theo schema:
{
  "term": "string|null",
  "term_start": "YYYY-MM-DD|null",
  "term_end": "YYYY-MM-DD|null",
  "courses": [
    {
      "code": "IT3090",
      "name": "Cơ sở dữ liệu",
      "class_code": "IT3090-1-26 (26.1A01)|null",
      "sessions": [
        {
          "date": "YYYY-MM-DD",
          "start_time": "HH:mm",
          "end_time": "HH:mm|null",
          "room": "string|null",
          "lecturer": "string|null",
          "note": "string|null",
          "confidence": 0.0
        }
      ],
      "warnings": ["string"]
    }
  ]
}`

function extractJson(text) {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1].trim() : trimmed
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start === -1 || end === -1) {
    throw new Error("Gemini không trả về JSON hợp lệ")
  }
  return JSON.parse(raw.slice(start, end + 1))
}

export async function parseScheduleWithGemini({
  filteredText,
  courseCodes,
  apiKey,
}) {
  if (!apiKey) {
    throw new Error(
      "Thiếu VITE_GEMINI_API_KEY trong .env.local. Thêm key rồi restart npm run dev."
    )
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  })

  const codes = courseCodes.map((c) => c.trim().toUpperCase()).filter(Boolean)

  const prompt = `${SYSTEM_PROMPT}

Danh sách mã học phần cần lấy: ${codes.join(", ")}

Văn bản PDF (đã lọc quanh các mã trên):
"""
${filteredText.slice(0, 24000)}
"""`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const data = extractJson(text)

  if (!data || !Array.isArray(data.courses)) {
    throw new Error("JSON thiếu mảng courses")
  }

  return data
}

/** Chuẩn hóa sessions thành danh sách lesson sẵn để lưu / review */
export function flattenParsedSessions(parsed) {
  const rows = []

  for (const course of parsed.courses || []) {
    const code = course.code || ""
    const name = course.name || code
    const subject = name.includes(code) ? name : `${code} - ${name}`

    for (const session of course.sessions || []) {
      if (!session.date || !session.start_time) continue

      const noteParts = [
        session.end_time ? `Đến ${session.end_time}` : null,
        session.lecturer ? `GV: ${session.lecturer}` : null,
        session.note || null,
        course.class_code || null,
      ].filter(Boolean)

      rows.push({
        id: `${code}-${session.date}-${session.start_time}-${session.room || ""}`,
        code,
        date: session.date,
        time: String(session.start_time).slice(0, 5),
        subject,
        room: session.room || "TBA",
        note: noteParts.join(" · "),
        confidence: session.confidence ?? null,
        selected: true,
      })
    }
  }

  rows.sort((a, b) => {
    const d = a.date.localeCompare(b.date)
    if (d !== 0) return d
    return a.time.localeCompare(b.time)
  })

  return rows
}

export function collectWarnings(parsed) {
  const list = []
  for (const course of parsed.courses || []) {
    for (const w of course.warnings || []) {
      list.push(`${course.code}: ${w}`)
    }
    if ((course.sessions || []).length === 0) {
      list.push(`${course.code}: Không tìm thấy buổi học cụ thể trong PDF`)
    }
  }
  return list
}
