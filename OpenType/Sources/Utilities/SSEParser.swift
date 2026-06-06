import Foundation

public struct SSEEvent {
    public let data: String
    public let event: String?
    public let id: String?

    public init(data: String, event: String? = nil, id: String? = nil) {
        self.data = data
        self.event = event
        self.id = id
    }
}

/// Parses Server-Sent Events (SSE) from a raw string or byte stream.
/// See: https://html.spec.whatwg.org/multipage/server-sent-events.html
public enum SSEParser {
    /// Parse a complete SSE response string into events.
    public static func parse(_ input: String) -> [SSEEvent] {
        var events: [SSEEvent] = []
        var currentData: [String] = []
        var currentEvent: String?
        var currentID: String?

        func flushEvent() {
            if !currentData.isEmpty {
                events.append(SSEEvent(
                    data: currentData.joined(separator: "\n"),
                    event: currentEvent,
                    id: currentID
                ))
            }
            currentData = []
            currentEvent = nil
            currentID = nil
        }

        for line in input.components(separatedBy: "\n") {
            if line.isEmpty {
                // Empty line = dispatch event
                flushEvent()
                continue
            }

            if line.hasPrefix("data: ") {
                currentData.append(String(line.dropFirst(6)))
            } else if line.hasPrefix("data:") {
                currentData.append(String(line.dropFirst(5)))
            } else if line.hasPrefix("event: ") {
                currentEvent = String(line.dropFirst(7))
            } else if line.hasPrefix("id: ") {
                currentID = String(line.dropFirst(4))
            }
            // Lines starting with ":" are comments — ignore
        }

        // Flush any remaining event (no trailing newline)
        flushEvent()

        return events
    }

    /// Parse a single SSE event's data as a JSON-decoded type.
    public static func decode<T: Decodable>(_ event: SSEEvent, as type: T.Type) -> T? {
        guard let data = event.data.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}
