import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { TailoredCv } from "@/lib/prospection-cv";

const styles = StyleSheet.create({
  page: {
    padding: 34,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: "#18181b",
    lineHeight: 1.35,
  },
  header: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#d4d4d8",
  },
  headerText: { flex: 1 },
  photo: {
    width: 78,
    height: 78,
    borderRadius: 39,
    objectFit: "cover",
  },
  name: { fontSize: 24, fontWeight: 700, marginBottom: 4 },
  headline: { fontSize: 12, color: "#2563eb", marginBottom: 7 },
  contact: { flexDirection: "row", flexWrap: "wrap", gap: 8, color: "#52525b" },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#111827",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  summary: { fontSize: 10.5, color: "#27272a" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
  chip: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "#eff6ff",
    borderRadius: 3,
    color: "#1e3a8a",
  },
  experience: { marginBottom: 9 },
  experienceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2,
  },
  role: { fontSize: 11, fontWeight: 700 },
  meta: { color: "#52525b" },
  bulletRow: { flexDirection: "row", gap: 5, marginTop: 2 },
  bullet: { width: 8, color: "#2563eb" },
  bulletText: { flex: 1 },
  twoCols: { flexDirection: "row", gap: 18 },
  col: { flex: 1 },
  line: { marginBottom: 3 },
});

function textOrDash(value: string) {
  return value.trim() || "-";
}

export function ProspectionCvPDF({
  cv,
  photoDataUrl,
}: {
  cv: TailoredCv;
  photoDataUrl: string | null;
}) {
  const contact = [cv.location, cv.email, cv.phone].filter(Boolean);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.name}>{textOrDash(cv.fullName)}</Text>
            <Text style={styles.headline}>{textOrDash(cv.headline)}</Text>
            <View style={styles.contact}>
              {contact.map((item) => (
                <Text key={item}>{item}</Text>
              ))}
            </View>
          </View>
          {photoDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={photoDataUrl} style={styles.photo} />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profil</Text>
          <Text style={styles.summary}>{cv.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compétences clés</Text>
          <View style={styles.chips}>
            {cv.skills.map((skill) => (
              <Text key={skill} style={styles.chip}>
                {skill}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expériences</Text>
          {cv.experiences.map((experience, index) => (
            <View key={`${experience.role}-${index}`} style={styles.experience}>
              <View style={styles.experienceHeader}>
                <View>
                  <Text style={styles.role}>{experience.role}</Text>
                  <Text style={styles.meta}>
                    {[experience.organization, experience.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </View>
                <Text style={styles.meta}>{experience.period}</Text>
              </View>
              {experience.bullets.map((bullet) => (
                <View key={bullet} style={styles.bulletRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={[styles.section, styles.twoCols]}>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Formation</Text>
            {cv.education.length > 0 ? (
              cv.education.map((item) => (
                <Text key={`${item.label}-${item.organization}`} style={styles.line}>
                  {item.label}
                  {item.organization ? ` · ${item.organization}` : ""}
                  {item.period ? ` · ${item.period}` : ""}
                </Text>
              ))
            ) : (
              <Text style={styles.meta}>-</Text>
            )}
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionTitle}>Certifications & langues</Text>
            {[...cv.certifications, ...cv.languages].map((item) => (
              <Text key={item} style={styles.line}>
                {item}
              </Text>
            ))}
          </View>
        </View>
      </Page>
    </Document>
  );
}
