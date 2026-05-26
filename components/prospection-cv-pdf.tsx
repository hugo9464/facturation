import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import {
  normalizeTailoredCvSkills,
  type TailoredCv,
  type TailoredCvSkill,
} from "@/lib/prospection-cv";

const PALE = "#fff3cf";
const SAGE = "#94a58d";
const SAGE_DARK = "#5c6d5a";
const TEXT = "#6a6a6a";
const TITLE = "#60705e";
const WHITE = "#ffffff";

const styles = StyleSheet.create({
  page: {
    position: "relative",
    padding: 0,
    fontSize: 8.2,
    fontFamily: "Helvetica",
    color: TEXT,
    lineHeight: 1.2,
    backgroundColor: WHITE,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 432,
    height: 66,
    backgroundColor: PALE,
  },
  name: {
    position: "absolute",
    top: 9,
    left: 0,
    width: 432,
    fontSize: 24,
    color: "#626262",
    textAlign: "center",
    fontWeight: 300,
  },
  headerRule: {
    position: "absolute",
    top: 37,
    left: 37,
    width: 358,
    borderTopWidth: 1,
    borderTopColor: "#777777",
  },
  headline: {
    position: "absolute",
    top: 42,
    left: 0,
    width: 432,
    fontSize: 14,
    color: "#686868",
    textAlign: "center",
    fontWeight: 300,
  },
  intro: {
    position: "absolute",
    top: 74,
    left: 18,
    width: 390,
    fontSize: 9,
    color: TEXT,
    lineHeight: 1.25,
  },
  main: {
    position: "absolute",
    top: 112,
    left: 10,
    width: 408,
    bottom: 12,
  },
  sidebar: {
    position: "absolute",
    top: 74,
    right: 0,
    width: 163,
    paddingHorizontal: 10,
    paddingTop: 22,
    paddingBottom: 22,
    backgroundColor: SAGE,
    color: WHITE,
  },
  contactTop: {
    position: "absolute",
    top: 6,
    right: 12,
    width: 142,
  },
  sidebarTitle: {
    marginBottom: 7,
    paddingVertical: 5,
    backgroundColor: SAGE_DARK,
    color: WHITE,
    fontSize: 14,
    textAlign: "center",
    fontWeight: 300,
  },
  contactLine: {
    marginLeft: 4,
    fontSize: 7.5,
    color: "#777777",
    lineHeight: 1.15,
  },
  photo: {
    alignSelf: "center",
    width: 54,
    height: 54,
    marginTop: 4,
    marginBottom: 12,
    borderRadius: 27,
    objectFit: "cover",
  },
  sidebarBlock: {
    marginBottom: 19,
  },
  sidebarText: {
    marginLeft: 8,
    marginBottom: 2,
    fontSize: 9.5,
    lineHeight: 1.18,
    color: WHITE,
  },
  skillRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 5,
    marginHorizontal: 7,
    marginBottom: 6,
  },
  skillName: {
    width: 84,
    color: WHITE,
    fontSize: 8.6,
  },
  dots: {
    width: 40,
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 0.7,
    borderColor: WHITE,
  },
  dotFilled: {
    backgroundColor: WHITE,
  },
  hobbyTitle: {
    marginTop: 8,
    marginHorizontal: 6,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: WHITE,
    color: WHITE,
    fontSize: 11,
  },
  hobbyText: {
    marginHorizontal: 6,
    marginTop: 3,
    color: WHITE,
    fontSize: 9,
  },
  section: {
    marginBottom: 9,
  },
  sectionTitle: {
    marginBottom: 6,
    paddingVertical: 3,
    backgroundColor: SAGE,
    color: WHITE,
    fontSize: 10,
    textAlign: "center",
    fontWeight: 700,
  },
  experience: {
    flexDirection: "row",
    marginLeft: 0,
    marginBottom: 8,
  },
  experienceBar: {
    width: 1.2,
    marginRight: 9,
    backgroundColor: SAGE,
  },
  experienceBody: {
    flex: 1,
  },
  experienceHeader: {
    marginBottom: 1,
  },
  role: {
    color: TITLE,
    fontSize: 11.8,
    fontWeight: 400,
  },
  period: {
    color: TEXT,
    fontSize: 8.1,
  },
  meta: {
    marginTop: 1,
    color: TEXT,
    fontSize: 8.2,
  },
  bullets: {
    marginTop: 2,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 5,
    marginLeft: 16,
    marginTop: 1,
  },
  bulletMark: {
    width: 5,
    color: TEXT,
  },
  bulletText: {
    flex: 1,
    color: TEXT,
    fontSize: 8.1,
  },
  stack: {
    marginTop: 5,
    color: TEXT,
    fontSize: 8,
  },
  compactLine: {
    marginLeft: 10,
    marginBottom: 2,
    color: TEXT,
    fontSize: 8.2,
  },
});

function textOrDash(value: string) {
  return value.trim() || "-";
}

function uniqueItems(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function uniqueSkills(values: TailoredCvSkill[]) {
  const seen = new Set<string>();
  return values.filter((skill) => {
    const key = skill.name.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function DotScale({ level = 4 }: { level?: number }) {
  return (
    <View style={styles.dots}>
      {[0, 1, 2, 3, 4].map((index) => (
        <View
          key={index}
          style={index < level ? [styles.dot, styles.dotFilled] : styles.dot}
        />
      ))}
    </View>
  );
}

function splitCertificationsAndLanguages(items: string[]) {
  const languageMarkers = [
    "français",
    "anglais",
    "espagnol",
    "allemand",
    "italien",
  ];
  const languages = items.filter((item) =>
    languageMarkers.some((marker) => item.toLowerCase().includes(marker)),
  );
  const certifications = items.filter((item) => !languages.includes(item));
  return { certifications, languages };
}

export function ProspectionCvPDF({
  cv,
  photoDataUrl,
}: {
  cv: TailoredCv;
  photoDataUrl: string | null;
}) {
  const contact = uniqueItems([cv.phone, cv.email, cv.location]);
  const skills = uniqueSkills(normalizeTailoredCvSkills(cv.skills)).slice(0, 8);
  const skillNames = skills.map((skill) => skill.name);
  const { certifications, languages } = splitCertificationsAndLanguages([
    ...cv.certifications,
    ...cv.languages,
  ]);
  const shownExperiences = cv.experiences.slice(0, 5);
  const stack = skillNames.slice(0, 8).join(", ");

  return (
    <Document>
      <Page size={{ width: 595, height: 822 }} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{textOrDash(cv.fullName)}</Text>
          <View style={styles.headerRule} />
          <Text style={styles.headline}>{textOrDash(cv.headline)}</Text>
        </View>

        <View style={styles.contactTop}>
          <Text style={styles.sidebarTitle}>Contact</Text>
          {contact.map((item) => (
            <Text key={item} style={styles.contactLine}>
              - {item}
            </Text>
          ))}
        </View>

        <Text style={styles.intro}>{cv.summary}</Text>

        <View style={styles.main}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Expérience Professionnelle</Text>
            {shownExperiences.map((experience, index) => {
              const meta = [experience.period, experience.location]
                .filter(Boolean)
                .join(" - ");

              return (
                <View key={`${experience.role}-${index}`} style={styles.experience}>
                  <View style={styles.experienceBar} />
                  <View style={styles.experienceBody}>
                    <View style={styles.experienceHeader}>
                      <Text style={styles.role}>
                        {[experience.role, experience.organization]
                          .filter(Boolean)
                          .join(" - ")}
                      </Text>
                      {meta ? <Text style={styles.period}>{meta}</Text> : null}
                    </View>
                    <View style={styles.bullets}>
                      {experience.bullets.slice(0, 4).map((bullet) => (
                        <View key={bullet} style={styles.bulletRow}>
                          <Text style={styles.bulletMark}>-</Text>
                          <Text style={styles.bulletText}>{bullet}</Text>
                        </View>
                      ))}
                    </View>
                    {stack ? <Text style={styles.stack}>Stack : {stack}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>

          {certifications.length ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Certifications</Text>
              {certifications.slice(0, 4).map((item) => (
                <Text key={item} style={styles.compactLine}>
                  - {item}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.sidebar}>
          {photoDataUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={photoDataUrl} style={styles.photo} />
          ) : null}

          <View style={styles.sidebarBlock}>
            <Text style={styles.sidebarTitle}>Formation</Text>
            {cv.education.length > 0 ? (
              cv.education.slice(0, 3).map((item) => (
                <Text
                  key={`${item.label}-${item.organization}`}
                  style={styles.sidebarText}
                >
                  {[item.label, item.organization, item.period]
                    .filter(Boolean)
                    .join("\n")}
                </Text>
              ))
            ) : (
              <Text style={styles.sidebarText}>-</Text>
            )}
          </View>

          <View style={styles.sidebarBlock}>
            <Text style={styles.sidebarTitle}>Compétences</Text>
            {skills.map((skill) => (
              <View key={skill.name} style={styles.skillRow}>
                <Text style={styles.skillName}>{skill.name}</Text>
                <DotScale level={skill.level} />
              </View>
            ))}
          </View>

          <View style={styles.sidebarBlock}>
            <Text style={styles.sidebarTitle}>Langues</Text>
            {languages.length ? (
              languages.slice(0, 3).map((language, index) => (
                <View key={language} style={styles.skillRow}>
                  <Text style={styles.skillName}>{language}</Text>
                  <DotScale level={index === 0 ? 5 : 4} />
                </View>
              ))
            ) : (
              <Text style={styles.sidebarText}>-</Text>
            )}
          </View>

          <View>
            <Text style={styles.sidebarTitle}>Loisirs</Text>
            <Text style={styles.hobbyTitle}>Sports</Text>
            <Text style={styles.hobbyText}>Cyclisme{"\n"}Course à pied</Text>
            <Text style={styles.hobbyTitle}>Musique</Text>
            <Text style={styles.hobbyText}>Guitare</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
