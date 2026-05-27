import Foundation

public enum EditCommand: Equatable {
    case rephrase
    case shorten
    case lengthen
    case changeTone(TonePreset?)
    case translate(to: String?)
    case summarize
    case explain
    case fixGrammar
    case custom

    public var isReadOnly: Bool {
        switch self {
        case .summarize, .explain, .translate: return true
        default: return false
        }
    }

    public var displayLabel: String {
        switch self {
        case .rephrase: return NSLocalizedString("edit.rephrased", value: "Rephrased", comment: "")
        case .shorten: return NSLocalizedString("edit.shortened", value: "Shortened", comment: "")
        case .lengthen: return NSLocalizedString("edit.lengthened", value: "Lengthened", comment: "")
        case .changeTone: return NSLocalizedString("edit.toneChanged", value: "Tone Changed", comment: "")
        case .translate(let lang): return String(format: NSLocalizedString("edit.translated", value: "Translated to %@", comment: ""), lang ?? "")
        case .summarize: return NSLocalizedString("edit.summarized", value: "Summarized", comment: "")
        case .explain: return NSLocalizedString("edit.explained", value: "Explained", comment: "")
        case .fixGrammar: return NSLocalizedString("edit.grammarFixed", value: "Grammar Fixed", comment: "")
        case .custom: return NSLocalizedString("edit.custom", value: "Edited", comment: "")
        }
    }
}
