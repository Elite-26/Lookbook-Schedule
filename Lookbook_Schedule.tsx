/**
 * @framerDisableUnlink
 * @framerSupportedLayoutWidth any
 * @framerSupportedLayoutHeight any
 * @framerIntrinsicWidth 800
 * @framerIntrinsicHeight 600
 */

import React, { useState, useEffect, useRef, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

interface PhotoSession {
  date: string
  model: string
  modelDetails: string
  modelSizing: string
  location: string
  status: "available" | "limited" | "full"
  thumbnailUrl: string
  modelImage: string
  locationImage: string
  price: number
}

interface CalendarComponentProps {
  whatsappNumber: string
  enableLocationFilter: boolean
  showStatusColors: boolean
  showPhotosOnHover: boolean
  defaultViewType: "default" | "compact"
  primaryColor: string
  primaryTextColor: string
  secondaryTextColor: string
  backgroundColor: string
  desktopWidth: number
  desktopHeight: number
  mobileWidth: number
  mobileHeight: number
  breakpoint: number
  style?: React.CSSProperties
}

export default function PhotoBookingCalendar(props: CalendarComponentProps) {
  const {
    whatsappNumber = "+1234567890",
    enableLocationFilter = true,
    showStatusColors = true,
    showPhotosOnHover = true,
    defaultViewType = "default",
    primaryColor = "#000000",
    primaryTextColor = "#ffffff",
    secondaryTextColor = "#666666",
    backgroundColor = "#ffffff",
    desktopWidth = 800,
    desktopHeight = 600,
    mobileWidth = 100,
    mobileHeight = 500,
    breakpoint = 768,
    style,
    ...otherProps
  } = props

  // Detect if we're in the Framer canvas
  const isCanvas = RenderTarget.current() === RenderTarget.canvas

  // State management
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedLocation, setSelectedLocation] = useState("all")
  const [viewType, setViewType] = useState<"default" | "compact">(
    defaultViewType
  )
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [hoveredSession, setHoveredSession] = useState<PhotoSession | null>(
    null
  )
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<PhotoSession[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [loadedMonths, setLoadedMonths] = useState<Set<string>>(new Set())
  const [noMoreData, setNoMoreData] = useState(false) // Track if there's no more data to load

  // Refs for positioning
  const calendarRef = useRef<HTMLDivElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)

  // Styling Defaults & Helpers
  const modalTextStyle = {
    margin: "0 0 4px 0",
    color: "#666666",
    fontSize: "14px",
  }

  // Function to fetch more data for a specific month
  const fetchMoreData = async (targetDate: Date) => {
    if (isCanvas) return

    // Don't fetch if we already know there's no more data
    if (noMoreData) return

    try {
      setLoading(true)

      // Get first day of the target month
      const firstDayOfMonth = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth(),
        1
      )

      // Fetch data for the specific month range
      const response = await fetch(
        "https://dev.ju.productions/search-records",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            fromDate: firstDayOfMonth.getTime(),
            page_size: 100,
          }),
        }
      )
      console.log(response)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.msg || "Failed to fetch data")
      }

      const result = await response.json()

      if (result.code !== 0) {
        throw new Error(result.msg || "API returned error")
      }

      // If no items returned, set noMoreData to true
      if (result.data.items.length === 0) {
        setNoMoreData(true)
      }

      // Transform and append new data
      const newData: PhotoSession[] = result.data.items
        .filter((item: any) => item.fields)
        .map((item: any) => {
          try {
            // Parse timestamp to date
            const dateObj = new Date(item.fields.Date)
            const year = dateObj.getFullYear()
            const month = String(dateObj.getMonth() + 1).padStart(
              2,
              "0"
            ) // months are 0-indexed
            const day = String(dateObj.getDate()).padStart(2, "0")
            const formattedDate = `${year}-${month}-${day}`

            return {
              date: formattedDate,
              model:
                Array.isArray(item.fields.Model) &&
                  item.fields.Model[0]?.text
                  ? item.fields.Model[0].text
                  : "Unknown Model",
              modelDetails:
                Array.isArray(item.fields["Model Details"]) &&
                  item.fields["Model Details"][0]?.text
                  ? item.fields["Model Details"][0].text
                  : "",
              modelSizing:
                Array.isArray(item.fields["Model Sizing"]) &&
                  item.fields["Model Sizing"][0]?.text
                  ? item.fields["Model Sizing"][0].text
                  : "",
              location:
                Array.isArray(item.fields.Location) &&
                  item.fields.Location[0]?.text
                  ? item.fields.Location[0].text
                  : "Unknown Location",
              thumbnailUrl:
                Array.isArray(item.fields["Thumbnail Url"]) &&
                  item.fields["Thumbnail Url"][0]?.text
                  ? item.fields["Thumbnail Url"][0].text
                  : "",
              modelImage:
                Array.isArray(item.fields["Model Url"]) &&
                  item.fields["Model Url"][0]?.text
                  ? item.fields["Model Url"][0].text
                  : "",
              locationImage:
                Array.isArray(item.fields["Location Url"]) &&
                  item.fields["Location Url"][0]?.text
                  ? item.fields["Location Url"][0].text
                  : "",
              status: (item.fields.Status?.toLowerCase() ||
                "available") as
                | "available"
                | "limited"
                | "full",
              price: item.fields.Price ?? 0,
            }
          } catch (error) {
            console.error("Error transforming item", item, error)
            throw error
          }
        })

      // Merge with existing sessions, avoiding duplicates
      setSessions((prevSessions) => {
        const existingIds = new Set(prevSessions.map((s) => s.date))
        const uniqueNewSessions = newData.filter(
          (s) => !existingIds.has(s.date)
        )
        return [...prevSessions, ...uniqueNewSessions]
      })

      // Mark this month as loaded
      const monthKey = `${targetDate.getFullYear()}-${targetDate.getMonth()}`
      setLoadedMonths((prev) => new Set([...prev, monthKey]))

      setLoading(false)
    } catch (err) {
      console.error("Error fetching more data:", err)
      setError(err.message || "Failed to load schedule data")
      setLoading(false)
    }
  }

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    // Check on mount
    checkMobile()

    // Add event listener for resize
    window.addEventListener("resize", checkMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile)
  }, [breakpoint])

  // Handle click outside modal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setSelectedDate(null)
      }
    }

    if (selectedDate) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [selectedDate])

  // Helper functions
  const getMonthName = (month: number): string => {
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]
    return months[month]
  }

  const getDaysInMonth = (year: number, month: number): number => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number): number => {
    return new Date(year, month, 1).getDay()
  }

  useEffect(() => {
    const fetchData = async () => {
      if (isCanvas) {
        // Mock data for Framer canvas
        setSessions(mockData)
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        const today = new Date()
        const firstDayOfMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          1
        )
        const fromDate = firstDayOfMonth.getTime()

        const response = await fetch(
          "https://dev.ju.productions/search-records",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fromDate,
              page_size: 100,
            }),
          }
        )

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.msg || "Failed to fetch data")
        }

        const result = await response.json()

        if (result.code !== 0) {
          throw new Error(result.msg || "API returned error")
        }

        if (result.data.items.length === 0) {
          setNoMoreData(true)
        }

        const transformedData: PhotoSession[] = result.data.items
          .filter((item: any) => item.fields)
          .map((item: any) => {
            const dateObj = new Date(item.fields.Date)
            const year = dateObj.getFullYear()
            const month = String(dateObj.getMonth() + 1).padStart(
              2,
              "0"
            )
            const day = String(dateObj.getDate()).padStart(2, "0")
            const formattedDate = `${year}-${month}-${day}`

            return {
              date: formattedDate,
              model:
                Array.isArray(item.fields.Model) &&
                  item.fields.Model[0]?.text
                  ? item.fields.Model[0].text
                  : "Unknown Model",
              modelDetails:
                Array.isArray(item.fields["Model Details"]) &&
                  item.fields["Model Details"][0]?.text
                  ? item.fields["Model Details"][0].text
                  : "",
              modelSizing:
                Array.isArray(item.fields["Model Sizing"]) &&
                  item.fields["Model Sizing"][0]?.text
                  ? item.fields["Model Sizing"][0].text
                  : "",
              location:
                Array.isArray(item.fields.Location) &&
                  item.fields.Location[0]?.text
                  ? item.fields.Location[0].text
                  : "Unknown Location",
              thumbnailUrl:
                Array.isArray(item.fields["Thumbnail Url"]) &&
                  item.fields["Thumbnail Url"][0]?.text
                  ? item.fields["Thumbnail Url"][0].text
                  : "",
              modelImage:
                Array.isArray(item.fields["Model Url"]) &&
                  item.fields["Model Url"][0]?.text
                  ? item.fields["Model Url"][0].text
                  : "",
              locationImage:
                Array.isArray(item.fields["Location Url"]) &&
                  item.fields["Location Url"][0]?.text
                  ? item.fields["Location Url"][0].text
                  : "",
              status: (item.fields.Status?.toLowerCase() ||
                "available") as
                | "available"
                | "limited"
                | "full",
              price: item.fields.Price ?? 0,
            }
          })

        setSessions(transformedData)

        const loadedMonthsSet = new Set<string>()
        transformedData.forEach((session) => {
          const [yearStr, monthStr] = session.date.split("-")
          const monthKey = `${yearStr}-${parseInt(monthStr) - 1}`
          loadedMonthsSet.add(monthKey)
        })
        setLoadedMonths(loadedMonthsSet)

        setLoading(false)
      } catch (err: any) {
        console.error("Error fetching data:", err)
        setError(err.message || "Failed to load schedule data")
        setLoading(false)
      }
    }

    fetchData()
  }, [isCanvas])

  // Filter sessions by location
  const filteredSessions = useMemo(() => {
    if (selectedLocation === "all") return sessions
    if (!sessions.length) return [] // Fast bailout if empty
    return sessions.filter(
      (session) => session.location === selectedLocation
    )
  }, [sessions, selectedLocation])

  // Get unique locations
  const locations = useMemo(() => {
    const locationSet = new Set<string>()
    sessions.forEach((session) => {
      if (session.location) {
        locationSet.add(session.location)
      }
    })
    return ["all", ...Array.from(locationSet).sort()]
  }, [sessions])

  // Handle hover positioning
  const handleSessionHover = (
    event: React.MouseEvent<HTMLDivElement>,
    session: PhotoSession
  ) => {
    if (!showPhotosOnHover || !calendarRef.current || isCanvas || isMobile)
      return

    const rect = calendarRef.current.getBoundingClientRect()
    const mouseX = event.clientX - rect.left
    const mouseY = event.clientY - rect.top

    let posX = mouseX + 10
    let posY = mouseY + 10

    // Adjust to prevent overflow
    const previewWidth = 320
    const previewHeight = 420

    if (posX + previewWidth > rect.width) {
      posX = mouseX - previewWidth
    }
    if (posY + previewHeight > rect.height) {
      posY = mouseY - previewHeight
    }

    setHoverPosition({ x: posX, y: posY })
    setHoveredSession(session)
  }

  const openWhatsApp = (session: PhotoSession) => {
    if (isCanvas) return

    const message = `I am interested in taking product photos with ${session.model} at ${session.location} on ${session.date}.`
    const encodedMessage = encodeURIComponent(message)
    const phoneNumber = whatsappNumber.replace(/\D/g, "") // Remove any non-digits
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`

    window.open(whatsappUrl, "_blank")
  }

  // Status color mapping
  const getStatusColor = (status: PhotoSession["status"]) => {
    if (!showStatusColors) return primaryColor

    const statusColors: Record<PhotoSession["status"], string> = {
      available: "#10B981", // green
      limited: "#F59E0B", // orange
      full: "#EF4444", // red
    }

    return statusColors[status] || primaryColor
  }

  // Render calendar grid
  const renderCalendar = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDayOfMonth = getFirstDayOfMonth(year, month)

    if (viewType === "compact") {
      const sessionsThisMonth = filteredSessions.filter((session) => {
        const sessionDate = new Date(session.date)
        return (
          sessionDate.getMonth() === month &&
          sessionDate.getFullYear() === year
        )
      })

      return (
        <div style={{ padding: "16px", flex: 1, overflowY: "auto" }}>
          {sessionsThisMonth.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px",
                color: secondaryTextColor,
              }}
            >
              No shoots scheduled for this month
            </div>
          ) : (
            sessionsThisMonth.map((session) => (
              <div
                key={session.date}
                onMouseEnter={(e) =>
                  handleSessionHover(e, session)
                }
                onMouseLeave={() => setHoveredSession(null)}
                onClick={() => setSelectedDate(session.date)}
                style={{
                  padding: "12px",
                  marginBottom: "8px",
                  border: `1px solid ${getStatusColor(session.status)}`,
                  borderRadius: "6px",
                  cursor: "pointer",
                  backgroundColor:
                    selectedDate === session.date
                      ? primaryColor
                      : "white",
                  color:
                    selectedDate === session.date
                      ? primaryTextColor
                      : primaryColor,
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {session.date}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: secondaryTextColor,
                      }}
                    >
                      {session.model}
                    </div>
                    <div
                      style={{
                        fontSize: "14px",
                        color: secondaryTextColor,
                      }}
                    >
                      Price: ${session.price}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: secondaryTextColor,
                      }}
                    >
                      {session.location}
                    </div>
                  </div>
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      backgroundColor: getStatusColor(
                        session.status
                      ),
                      color: "white",
                      fontSize: "12px",
                    }}
                  >
                    {session.status
                      .charAt(0)
                      .toUpperCase() +
                      session.status.slice(1)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )
    }

    // Default Calendar View
    const calendarDays = []

    // Add empty spaces before the first day
    for (let i = 0; i < firstDayOfMonth; i++) {
      calendarDays.push(
        <div
          key={`empty-${i}`}
          style={{
            width: "100%",
            aspectRatio: "1/1",
            border: "1px solid #e5e7eb",
          }}
        />
      )
    }

    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      const sessionsOnDay = filteredSessions.filter(
        (session) => session.date === dateString
      )
      const isSelected = selectedDate === dateString

      calendarDays.push(
        <div
          key={day}
          onMouseEnter={(e) =>
            sessionsOnDay[0] &&
            handleSessionHover(e, sessionsOnDay[0])
          }
          onMouseLeave={() => setHoveredSession(null)}
          onClick={() => setSelectedDate(dateString)}
          style={{
            width: "100%",
            aspectRatio: "1/1",
            border: `1px solid ${sessionsOnDay.length > 0
              ? getStatusColor(sessionsOnDay[0].status)
              : "#e5e7eb"
              }`,
            backgroundColor: isSelected
              ? primaryColor
              : sessionsOnDay.length > 0
                ? "rgba(0,0,0,0.03)"
                : "transparent",
            color: isSelected ? primaryTextColor : primaryColor,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor:
              sessionsOnDay.length > 0 ? "pointer" : "default",
            transition: "all 0.2s ease",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: "500" }}>
            {day}
          </div>
          {sessionsOnDay.length > 0 && (
            <div
              style={{
                fontSize: "12px",
                color: secondaryTextColor,
                marginTop: "4px",
              }}
            >
              {sessionsOnDay[0].model.split(" ")[0]}
            </div>
          )}
        </div>
      )
    }

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)", F
          gap: "4px",
          padding: "8px 8px 16px 8px",
          flex: 1,
          alignContent: "start",
          position: "relative",
          minHeight: "100%", // prevents shrinking on empty
        }}
      >
        {/* Weekday Headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
          (day) => (
            <div
              key={day}
              style={{
                textAlign: "center",
                fontWeight: 600,
                padding: "8px 0",
                color: secondaryTextColor,
              }}
            >
              {day}
            </div>
          )
        )}

        {/* Days */}
        {calendarDays}

        {/* Empty calendar fallback */}
        {filteredSessions.length === 0 && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              color: secondaryTextColor,
              fontSize: "16px",
              fontWeight: "500",
              pointerEvents: "none",
            }}
          >
            No shoots scheduled for this month
          </div>
        )}
      </div>
    )
  }

  // Loading or Error View
  if (loading || error) {
    return (
      <div
        style={{
          ...style,
          width: "100%",
          maxWidth: `${desktopWidth}px`,
          height: isMobile
            ? `${mobileHeight}px`
            : `${desktopHeight}px`,
          backgroundColor: backgroundColor,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: error ? "#EF4444" : primaryColor,
          fontSize: "16px",
          fontWeight: "500",
          textAlign: "center",
          padding: "20px",
          margin: isMobile ? "0 auto" : undefined,
          borderRadius: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        }}
      >
        {error ? error : "Loading schedule..."}
      </div>
    )
  }

  return (
    <div
      ref={calendarRef}
      style={{
        ...style,
        width: "100%",
        maxWidth: `${desktopWidth}px`, // Optional: cap desktop max width
        height: isMobile ? `${mobileHeight}px` : `${desktopHeight}px`,
        backgroundColor: backgroundColor,
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        position: "relative",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
      {...otherProps}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: primaryColor,
          color: primaryTextColor,
        }}
      >
        <button
          onClick={() => {
            const newDate = new Date(currentDate)
            newDate.setMonth(currentDate.getMonth() - 1)
            setCurrentDate(newDate)
          }}
          style={{
            background: "none",
            border: "none",
            color: primaryTextColor,
            cursor: "pointer",
            fontSize: "20px",
            padding: "0 8px",
          }}
        >
          ←
        </button>

        <h2 style={{ margin: 0, fontSize: "20px" }}>
          {getMonthName(currentDate.getMonth())}{" "}
          {currentDate.getFullYear()}
        </h2>

        <button
          onClick={() => {
            const newDate = new Date(currentDate)
            newDate.setMonth(currentDate.getMonth() + 1)
            setCurrentDate(newDate)

            // Check if we need to load more data
            const monthKey = `${newDate.getFullYear()}-${newDate.getMonth()}`
            if (!loadedMonths.has(monthKey) && !noMoreData) {
              // Check if data for this month is already loaded in sessions
              const hasDataForMonth = sessions.some((session) => {
                const sessionDate = new Date(session.date)
                return (
                  sessionDate.getMonth() ===
                  newDate.getMonth() &&
                  sessionDate.getFullYear() ===
                  newDate.getFullYear()
                )
              })

              if (!hasDataForMonth) {
                fetchMoreData(newDate)
              }
            }
          }}
          style={{
            background: "none",
            border: "none",
            color: primaryTextColor,
            cursor: "pointer",
            fontSize: "20px",
            padding: "0 8px",
          }}
        >
          →
        </button>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          justifyContent: "space-between",
          padding: "16px",
          borderBottom: "1px solid #e5e7eb",
          gap: isMobile ? "12px" : "0",
        }}
      >
        {enableLocationFilter && (
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #e5e7eb",
              backgroundColor: "white",
              color: primaryColor,
              width: isMobile ? "100%" : "auto",
            }}
          >
            {locations.map((location) => (
              <option key={location} value={location}>
                {location === "all"
                  ? "All Locations"
                  : location}
              </option>
            ))}
          </select>
        )}

        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: isMobile ? "center" : "flex-end",
          }}
        >
          <button
            onClick={() => setViewType("default")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: `1px solid ${primaryColor}`,
              backgroundColor:
                viewType === "default"
                  ? primaryColor
                  : "transparent",
              color:
                viewType === "default"
                  ? primaryTextColor
                  : primaryColor,
              cursor: "pointer",
              flex: isMobile ? 1 : "none",
            }}
          >
            Default
          </button>
          <button
            onClick={() => setViewType("compact")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: `1px solid ${primaryColor}`,
              backgroundColor:
                viewType === "compact"
                  ? primaryColor
                  : "transparent",
              color:
                viewType === "compact"
                  ? primaryTextColor
                  : primaryColor,
              cursor: "pointer",
              flex: isMobile ? 1 : "none",
            }}
          >
            Compact
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {renderCalendar()}
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
            }}
          >
            <div
              style={{
                padding: "12px 24px",
                backgroundColor: primaryColor,
                color: primaryTextColor,
                borderRadius: "8px",
                fontSize: "14px",
              }}
            >
              Loading schedule...
            </div>
          </div>
        )}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <AnimatePresence>
          {filteredSessions
            .filter((session) => session.date === selectedDate)
            .map((session) => (
              <motion.div
                key={session.date}
                ref={modalRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  bottom: isMobile ? "0" : "16px",
                  left: "16px",
                  right: "16px",
                  margin: isMobile ? "0 auto" : undefined,
                  padding: "16px",
                  backgroundColor: "#ffffff",
                  borderRadius: "12px",
                  boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
                  border: "1px solid #e5e7eb",
                  zIndex: 50,
                  maxWidth: "800px",
                }}
              >
                {/* Close Button */}
                <button
                  onClick={() => setSelectedDate(null)}
                  style={{
                    position: "absolute",
                    top: "8px",
                    right: "8px",
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    color: secondaryTextColor,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  aria-label="Close"
                >
                  ×
                </button>

                {/* Modal Content */}
                <div
                  style={{
                    display: "flex",
                    gap: "16px",
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      flex: isMobile ? "none" : "0 0 40%",
                      aspectRatio: "4 / 5",
                      borderRadius: "8px",
                      overflow: "hidden",
                      backgroundColor: "#f3f4f6",
                    }}
                  >
                    {session.thumbnailUrl && (
                      <img
                        src={session.thumbnailUrl}
                        alt={session.model}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          display: "block",
                        }}
                      />
                    )}
                  </div>

                  {/* Session Text Details */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: "4px",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 8px 0",
                        color: primaryColor,
                      }}
                    >
                      {session.model || "Unknown Model"}
                    </h3>
                    <p style={modalTextStyle}>
                      Location:{" "}
                      {session.location || "Unknown"}
                    </p>
                    <p style={modalTextStyle}>
                      Price: ${session.price || 0}
                    </p>
                    <p style={modalTextStyle}>
                      Status: {session.status}
                    </p>
                    {session.modelDetails && (
                      <p style={modalTextStyle}>
                        {session.modelDetails}
                      </p>
                    )}
                    {session.modelSizing && (
                      <p style={modalTextStyle}>
                        {session.modelSizing}
                      </p>
                    )}
                  </div>
                </div>

                {/* WhatsApp Booking Button */}
                <button
                  onClick={() => openWhatsApp(session)}
                  disabled={session.status === "full"}
                  style={{
                    marginTop: "16px",
                    width: "100%",
                    padding: "12px",
                    backgroundColor:
                      session.status === "full"
                        ? "#9CA3AF"
                        : "#25D366",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    cursor:
                      session.status === "full"
                        ? "not-allowed"
                        : "pointer",
                    fontWeight: 600,
                    fontSize: "16px",
                  }}
                >
                  {session.status === "full"
                    ? "Fully Booked"
                    : "Book via WhatsApp"}
                </button>
              </motion.div>
            ))}
        </AnimatePresence>
      )}

      {/* Hover Preview */}
      {/* Hover Preview */}
      {hoveredSession && showPhotosOnHover && !isCanvas && !isMobile && (
        <div
          ref={previewRef}
          style={{
            position: "absolute",
            top: hoverPosition.y,
            left: hoverPosition.x,
            backgroundColor: "white",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            padding: "16px",
            width: "300px",
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          {(hoveredSession.modelImage ||
            hoveredSession.locationImage) && (
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                {hoveredSession.modelImage && (
                  <img
                    src={hoveredSession.modelImage}
                    alt={hoveredSession.model}
                    style={{
                      width: "100px",
                      height: "100px",
                      objectFit: "cover",
                      borderRadius: "6px",
                    }}
                  />
                )}
                {hoveredSession.locationImage && (
                  <img
                    src={hoveredSession.locationImage}
                    alt={hoveredSession.location}
                    style={{
                      width: "100px",
                      height: "100px",
                      objectFit: "cover",
                      borderRadius: "6px",
                    }}
                  />
                )}
              </div>
            )}

          <h4 style={{ margin: "0 0 8px 0", color: primaryColor }}>
            {hoveredSession.model}
          </h4>
          <p
            style={{
              margin: "0 0 4px 0",
              color: secondaryTextColor,
              fontSize: "14px",
            }}
          >
            {hoveredSession.location}
          </p>
          <p
            style={{
              margin: "0 0 4px 0",
              color: secondaryTextColor,
              fontSize: "14px",
            }}
          >
            Price: ${hoveredSession.price}
          </p>
          {hoveredSession.modelDetails && (
            <p
              style={{
                margin: "0",
                color: secondaryTextColor,
                fontSize: "12px",
              }}
            >
              {hoveredSession.modelDetails}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// Mock data for Framer canvas
const mockData: PhotoSession[] = [
  {
    date: "2025-04-21",
    model: "Sarah Johnson",
    modelDetails:
      'Height: 5\'9", Weight: 130lbs, Bust: 34", Shoulder: 15", Waist: 28"',
    modelSizing: "US 4-6 / EU 36-38 / UK 8-10",
    location: "Downtown Studio",
    status: "available",
    thumbnailUrl: "/api/placeholder/400/400",
    modelImage: "/api/placeholder/400/400",
    locationImage: "/api/placeholder/400/400",
    price: 120,
  },
  {
    date: "2025-04-23",
    model: "Emma Wilson",
    modelDetails:
      'Height: 5\'8", Weight: 125lbs, Bust: 33", Shoulder: 14", Waist: 27"',
    modelSizing: "US 2-4 / EU 34-36 / UK 6-8",
    location: "Riverside Studio",
    status: "limited",
    thumbnailUrl: "/api/placeholder/400/400",
    modelImage: "/api/placeholder/400/400",
    locationImage: "/api/placeholder/400/400",
    price: 140,
  },
  {
    date: "2025-04-27",
    model: "Lisa Chen",
    modelDetails:
      'Height: 5\'6", Weight: 118lbs, Bust: 32", Shoulder: 13", Waist: 26"',
    modelSizing: "US 0-2 / EU 32-34 / UK 4-6",
    location: "Midtown Studio",
    status: "full",
    thumbnailUrl: "/api/placeholder/400/400",
    modelImage: "/api/placeholder/400/400",
    locationImage: "/api/placeholder/400/400",
    price: 100,
  },
]

// Property Controls
addPropertyControls(PhotoBookingCalendar, {
  whatsappNumber: {
    type: ControlType.String,
    title: "WhatsApp Number",
    defaultValue: "+1234567890",
    placeholder: "+1234567890",
  },
  enableLocationFilter: {
    type: ControlType.Boolean,
    title: "Enable Location Filter",
    defaultValue: true,
  },
  showStatusColors: {
    type: ControlType.Boolean,
    title: "Show Status Colors",
    defaultValue: true,
  },
  showPhotosOnHover: {
    type: ControlType.Boolean,
    title: "Show Photos on Hover",
    defaultValue: true,
  },
  defaultViewType: {
    type: ControlType.Enum,
    title: "Default View",
    options: ["default", "compact"],
    optionTitles: ["Default", "Compact"],
    defaultValue: "default",
  },
  primaryColor: {
    type: ControlType.Color,
    title: "Primary Color",
    defaultValue: "#000000",
  },
  primaryTextColor: {
    type: ControlType.Color,
    title: "Primary Text Color",
    defaultValue: "#ffffff",
  },
  secondaryTextColor: {
    type: ControlType.Color,
    title: "Secondary Text Color",
    defaultValue: "#666666",
  },
  backgroundColor: {
    type: ControlType.Color,
    title: "Background Color",
    defaultValue: "#ffffff",
  },
  desktopWidth: {
    type: ControlType.Number,
    title: "Desktop Width",
    defaultValue: 800,
    min: 400,
    max: 1200,
    unit: "px",
    step: 10,
  },
  desktopHeight: {
    type: ControlType.Number,
    title: "Desktop Height",
    defaultValue: 600,
    min: 400,
    max: 1000,
    unit: "px",
    step: 10,
  },
  mobileWidth: {
    type: ControlType.Number,
    title: "Mobile Width",
    defaultValue: 100,
    min: 80,
    max: 100,
    unit: "%",
    step: 1,
  },
  mobileHeight: {
    type: ControlType.Number,
    title: "Mobile Height",
    defaultValue: 500,
    min: 300,
    max: 800,
    unit: "px",
    step: 10,
  },
  breakpoint: {
    type: ControlType.Number,
    title: "Mobile Breakpoint",
    defaultValue: 768,
    min: 480,
    max: 1024,
    unit: "px",
    step: 10,
  },
})
