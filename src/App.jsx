import { useEffect, useState } from "react"
import { supabase } from "./supabase"
import AuthScreen from "./AuthScreen"
import ImportSchedule from "./ImportSchedule"
import { getDisplayUsername } from "./authHelpers"
import "./App.css"
import {
  formatLunarCellLabel,
  formatLunarFullLabel,
  getLunarFromDateString,
} from "./lunar"

const SUBJECT_COLORS = {
  Toán: "#e8913a",
  "Anh văn": "#5aa86a",
  "Hóa học": "#5b8fd9",
  "Tin học": "#8b6bc9",
  "Sinh học": "#3a9b8e",
  GDCD: "#c17a3a",
  "Vật lý": "#6b7fd7",
}

function getSubjectColor(subject) {
  return SUBJECT_COLORS[subject] || "#d49b21"
}

function formatDateKey(year, month, day) {
  const monthNumber = String(month + 1).padStart(2, "0")
  const dayNumber = String(day).padStart(2, "0")
  return `${year}-${monthNumber}-${dayNumber}`
}

/** Chuẩn hóa dòng từ Supabase cho UI */
function normalizeLesson(row) {
  return {
    id: row.id,
    date: row.date,
    time: String(row.time || "").slice(0, 5),
    subject: row.subject || "",
    room: row.room || "",
    note: row.note || "",
    specialNote: row.special_note || "",
  }
}

function App() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("calendar")

  const [currentDate, setCurrentDate] = useState(new Date(2026, 8, 1))
  const [selectedDate, setSelectedDate] = useState("2026-09-08")
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const [date, setDate] = useState("2026-09-08")
  const [time, setTime] = useState("")
  const [subject, setSubject] = useState("")
  const [room, setRoom] = useState("")
  const [note, setNote] = useState("")
  const [specialNote, setSpecialNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
      if (!nextSession) {
        setLessons([])
        setActiveTab("calendar")
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return

    async function fetchLessons() {
      setLoading(true)
      setLoadError(null)

      const { data, error } = await supabase
        .from("lessons")
        .select("*")
        .order("date", { ascending: true })
        .order("time", { ascending: true })

      if (error) {
        console.error("Error:", error)
        setLoadError(error.message)
        setLessons([])
      } else {
        setLessons((data || []).map(normalizeLesson))
      }

      setLoading(false)
    }

    fetchLessons()
  }, [session])

  function resetFormFields(nextDate = selectedDate) {
    setEditingId(null)
    setDate(nextDate)
    setTime("")
    setSubject("")
    setRoom("")
    setNote("")
    setSpecialNote("")
  }

  function openCreateForm() {
    resetFormFields(selectedDate)
    setShowForm(true)
  }

  function openEditForm(lesson) {
    setEditingId(lesson.id)
    setDate(lesson.date)
    setTime(lesson.time)
    setSubject(lesson.subject)
    setRoom(lesson.room)
    setNote(lesson.note || "")
    setSpecialNote(lesson.specialNote || "")
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    resetFormFields(selectedDate)
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const monthNameRaw = currentDate.toLocaleDateString("vi-VN", {
    month: "long",
    year: "numeric",
  })
  const monthName =
    monthNameRaw.charAt(0).toUpperCase() + monthNameRaw.slice(1)

  const firstDay = new Date(year, month, 1)
  const startDay = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const calendarDays = []

  for (let i = startDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i
    const prev = new Date(year, month - 1, day)
    calendarDays.push({
      day,
      dateString: formatDateKey(
        prev.getFullYear(),
        prev.getMonth(),
        day
      ),
      outside: true,
      dayOfWeek: (prev.getDay() + 6) % 7,
    })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      dateString: formatDateKey(year, month, day),
      outside: false,
      dayOfWeek: (startDay + day - 1) % 7,
    })
  }

  const remaining = 42 - calendarDays.length
  for (let day = 1; day <= remaining; day++) {
    const next = new Date(year, month + 1, day)
    calendarDays.push({
      day,
      dateString: formatDateKey(
        next.getFullYear(),
        next.getMonth(),
        day
      ),
      outside: true,
      dayOfWeek: (next.getDay() + 6) % 7,
    })
  }

  function getLessonsForDate(dateString) {
    return lessons
      .filter((lesson) => lesson.date === dateString)
      .sort((a, b) => a.time.localeCompare(b.time))
  }

  function goToPreviousMonth() {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  function goToNextMonth() {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  async function saveLesson() {
    if (!date || !time || !subject || !room) {
      alert("Vui lòng nhập ngày, giờ, môn học và phòng học")
      return
    }

    setSaving(true)

    const payload = {
      date,
      time,
      subject,
      room,
      note: note || null,
      special_note: specialNote.trim() || null,
    }

    let data
    let error

    if (editingId) {
      ;({ data, error } = await supabase
        .from("lessons")
        .update(payload)
        .eq("id", editingId)
        .select()
        .single())
    } else {
      ;({ data, error } = await supabase
        .from("lessons")
        .insert({
          ...payload,
          user_id: session.user.id,
        })
        .select()
        .single())
    }

    setSaving(false)

    if (error) {
      console.error("Save error:", error)
      alert(
        (editingId ? "Không cập nhật được tiết học: " : "Không lưu được tiết học: ") +
          error.message
      )
      return
    }

    const saved = normalizeLesson(data)

    if (editingId) {
      setLessons((prev) =>
        prev.map((lesson) => (lesson.id === editingId ? saved : lesson))
      )
    } else {
      setLessons((prev) => [...prev, saved])
    }

    setSelectedDate(date)

    const selected = new Date(date + "T00:00:00")
    setCurrentDate(
      new Date(selected.getFullYear(), selected.getMonth(), 1)
    )

    closeForm()
  }

  async function deleteLesson(lesson) {
    const ok = window.confirm(
      `Xóa tiết ${lesson.subject} lúc ${lesson.time}?`
    )
    if (!ok) return

    setDeletingId(lesson.id)

    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lesson.id)

    setDeletingId(null)

    if (error) {
      console.error("Delete error:", error)
      alert("Không xóa được tiết học: " + error.message)
      return
    }

    setLessons((prev) => prev.filter((item) => item.id !== lesson.id))
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      alert("Không đăng xuất được: " + error.message)
    }
  }

  if (authLoading) {
    return (
      <div className="app boot-screen">
        <div className="status-banner">Đang kiểm tra đăng nhập...</div>
      </div>
    )
  }

  if (!session) {
    return <AuthScreen />
  }

  const selectedLessons = getLessonsForDate(selectedDate)
  const selectedDateObject = new Date(selectedDate + "T00:00:00")
  const selectedLunar = getLunarFromDateString(selectedDate)

  const selectedDateText = selectedDateObject.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })

  const capitalizedDateText =
    selectedDateText.charAt(0).toUpperCase() + selectedDateText.slice(1)

  return (
    <div className="app">
      <header className="header">
        <button className="icon-button" type="button" aria-label="Menu">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <div className="month-picker">
          <button
            className="month-nav"
            type="button"
            onClick={goToPreviousMonth}
            aria-label="Tháng trước"
          >
            ‹
          </button>

          <button className="month-title" type="button">
            <span>{monthName}</span>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M7 10l5 5 5-5H7z" />
            </svg>
          </button>

          <button
            className="month-nav"
            type="button"
            onClick={goToNextMonth}
            aria-label="Tháng sau"
          >
            ›
          </button>
        </div>

        <div className="header-actions">
          <button className="icon-button" type="button" aria-label="Lịch">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3.5" y="5" width="17" height="15" rx="2" />
              <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
              <path d="M9 14.5l2 2 4-4" />
            </svg>
          </button>
          <button className="icon-button" type="button" aria-label="Thêm">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
              <circle cx="12" cy="6" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="18" r="1.6" />
            </svg>
          </button>
        </div>
      </header>

      <div className="binder" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, index) => (
          <span className="binder-ring" key={index} />
        ))}
      </div>

      <main className="main">
        {activeTab === "settings" ? (
          <section className="settings-panel">
            <h2>Cài đặt</h2>
            <div className="settings-card">
              <div className="settings-label">Tên đăng nhập</div>
              <div className="settings-value">
                {getDisplayUsername(session.user)}
              </div>
            </div>
            <button
              className="logout-button"
              type="button"
              onClick={handleLogout}
            >
              Đăng xuất
            </button>
          </section>
        ) : activeTab === "import" ? (
          <ImportSchedule
            userId={session.user.id}
            existingLessons={lessons}
            onBack={() => setActiveTab("calendar")}
            onImported={(insertedRows, meta) => {
              const normalized = insertedRows.map(normalizeLesson)
              setLessons((prev) => [...prev, ...normalized])
              setActiveTab("calendar")
              if (normalized[0]?.date) {
                setSelectedDate(normalized[0].date)
                const d = new Date(normalized[0].date + "T00:00:00")
                setCurrentDate(new Date(d.getFullYear(), d.getMonth(), 1))
              }
              alert(
                `Đã lưu ${meta.saved} buổi.` +
                  (meta.skipped
                    ? ` Bỏ qua ${meta.skipped} buổi trùng.`
                    : "")
              )
            }}
          />
        ) : (
          <>
            {loading && (
              <div className="status-banner">Đang tải lịch học...</div>
            )}

            {loadError && (
              <div className="status-banner error">
                Không tải được dữ liệu: {loadError}
              </div>
            )}

            <div className="calendar">
              <div className="week-header">
                <div>T2</div>
                <div>T3</div>
                <div>T4</div>
                <div>T5</div>
                <div>T6</div>
                <div>T7</div>
                <div className="sunday">CN</div>
              </div>

              <div className="calendar-grid">
                {calendarDays.map((cell) => {
                  const dayLessons = getLessonsForDate(cell.dateString)
                  const isSelected = selectedDate === cell.dateString
                  const isSunday = cell.dayOfWeek === 6
                  const lunar = getLunarFromDateString(cell.dateString)
                  const lunarLabel = formatLunarCellLabel(lunar)
                  const hasSpecial = dayLessons.some((l) => l.specialNote)

                  return (
                    <button
                      className={`calendar-cell ${isSelected ? "selected" : ""} ${
                        cell.outside ? "outside" : ""
                      } ${hasSpecial ? "has-special" : ""}`}
                      key={cell.dateString}
                      type="button"
                      onClick={() => {
                        setSelectedDate(cell.dateString)
                        if (cell.outside) {
                          const picked = new Date(cell.dateString + "T00:00:00")
                          setCurrentDate(
                            new Date(picked.getFullYear(), picked.getMonth(), 1)
                          )
                        }
                      }}
                    >
                      <div className="day-header">
                        <div
                          className={`day-number ${isSunday ? "sunday" : ""} ${
                            isSelected ? "selected-day" : ""
                          }`}
                        >
                          {cell.day}
                        </div>
                        <div
                          className={`lunar-day ${
                            lunar.day === 1 ? "lunar-first" : ""
                          }`}
                        >
                          {lunarLabel}
                        </div>
                      </div>

                      <div className="cell-lessons">
                        {dayLessons.slice(0, 2).map((lesson) => (
                          <div className="mini-lesson" key={lesson.id}>
                            <div className="mini-time">
                              <span
                                className="dot"
                                style={{
                                  background: getSubjectColor(lesson.subject),
                                }}
                              />
                              {lesson.time}
                            </div>
                            <div className="mini-subject">{lesson.subject}</div>
                            <div className="mini-room">{lesson.room}</div>
                            {lesson.specialNote && (
                              <div className="mini-special">
                                {lesson.specialNote}
                              </div>
                            )}
                          </div>
                        ))}

                        {dayLessons.length > 2 && (
                          <div className="more-lessons">
                            +{dayLessons.length - 2} tiết
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <section className="day-detail">
              <div className="detail-header">
                <div className="detail-date-block">
                  <div className="detail-date">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3.5" y="5" width="17" height="15" rx="2" />
                      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
                    </svg>
                    <span>{capitalizedDateText}</span>
                  </div>
                  <div className="detail-lunar">
                    Âm lịch: {formatLunarFullLabel(selectedLunar)}
                  </div>
                </div>

                <div className="lesson-count">
                  {selectedLessons.length} tiết học
                </div>
              </div>

              {selectedLessons.length === 0 ? (
                <div className="no-lesson">Hôm nay không có tiết học</div>
              ) : (
                <div className="detail-list">
                  {selectedLessons.map((lesson, index) => {
                    const color = getSubjectColor(lesson.subject)
                    const isLast = index === selectedLessons.length - 1

                    return (
                      <div className="detail-lesson" key={lesson.id}>
                        <div className="timeline">
                          <span
                            className="timeline-dot"
                            style={{ background: color }}
                          />
                          {!isLast && <span className="timeline-line" />}
                        </div>

                        <div
                          className="detail-time"
                          style={{ borderColor: color, color }}
                        >
                          {lesson.time}
                        </div>

                        <div className="detail-info">
                          <div className="detail-subject">{lesson.subject}</div>
                          <div className="detail-room">Phòng {lesson.room}</div>
                          {lesson.specialNote && (
                            <div className="detail-special">
                              {lesson.specialNote}
                            </div>
                          )}
                          {lesson.note && (
                            <div className="detail-note">
                              <span aria-hidden="true">📝</span> {lesson.note}
                            </div>
                          )}
                        </div>

                        <div className="detail-actions">
                          <button
                            className="action-button edit"
                            type="button"
                            aria-label="Sửa tiết học"
                            onClick={() => openEditForm(lesson)}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
                              <path d="M13.5 6.5l3 3" />
                            </svg>
                          </button>
                          <button
                            className="action-button delete"
                            type="button"
                            aria-label="Xóa tiết học"
                            disabled={deletingId === lesson.id}
                            onClick={() => deleteLesson(lesson)}
                          >
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 7h14" />
                              <path d="M9 7V5h6v2" />
                              <path d="M8 7l1 12h6l1-12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {activeTab === "calendar" && (
        <button
          className="add-button"
          type="button"
          onClick={openCreateForm}
          aria-label="Thêm tiết học"
        >
          +
        </button>
      )}

      {showForm && (
        <div className="modal-background">
          <div className="modal">
            <div className="modal-header">
              <h2>{editingId ? "Sửa tiết học" : "Thêm tiết học"}</h2>
              <button type="button" onClick={closeForm}>
                ×
              </button>
            </div>

            <label>Ngày học</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />

            <label>Môn học</label>
            <input
              type="text"
              placeholder="Ví dụ: Toán"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />

            <label>Giờ học</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />

            <label>Phòng học</label>
            <input
              type="text"
              placeholder="Ví dụ: A101"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            />

            <label>
              Note thường <span>(optional)</span>
            </label>
            <textarea
              placeholder="Ví dụ: Mang laptop..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <label>
              Note đặc biệt <span>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Thi GK, Thi CK, Thuyết trình..."
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
            />
            <div className="special-presets">
              {["Thi GK", "Thi CK", "Thuyết trình", "Nộp bài", "Project"].map(
                (label) => (
                  <button
                    key={label}
                    type="button"
                    className="special-preset"
                    onClick={() => setSpecialNote(label)}
                  >
                    {label}
                  </button>
                )
              )}
            </div>

            <button
              className="save-button"
              type="button"
              onClick={saveLesson}
              disabled={saving}
            >
              {saving
                ? "Đang lưu..."
                : editingId
                  ? "Lưu thay đổi"
                  : "Thêm tiết học"}
            </button>
          </div>
        </div>
      )}

      <nav className="bottom-nav">
        <button
          className={`nav-item ${activeTab === "calendar" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("calendar")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3.5" y="5" width="17" height="15" rx="2" />
            <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
            <path d="M8 14h2M12 14h2M16 14h.01M8 17h2M12 17h2" />
          </svg>
          <span>Lịch</span>
        </button>

        <button
          className={`nav-item ${activeTab === "import" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("import")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="M8 7l4-4 4 4" />
            <path d="M5 14v4.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V14" />
          </svg>
          <span>Import lịch</span>
        </button>

        <button className="nav-item" type="button">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4.5h9.5L18 7v12.5H6z" />
            <path d="M15.5 4.5V7H18M8.5 11h7M8.5 14.5h7M8.5 18h4" />
          </svg>
          <span>Ghi chú</span>
        </button>

        <button
          className={`nav-item ${activeTab === "settings" ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTab("settings")}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.8 6.8l1.4 1.4M15.8 15.8l1.4 1.4M17.2 6.8l-1.4 1.4M8.2 15.8l-1.4 1.4" />
          </svg>
          <span>Cài đặt</span>
        </button>
      </nav>
    </div>
  )
}

export default App
