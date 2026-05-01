import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { formatCents } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { rateTypeLabel } from "@/lib/invoice-grouping";
import { QUOTE_ACCEPTANCE_MENTION } from "@/lib/legal";
import type {
  Client,
  Profile,
  Quote,
  QuoteLine,
} from "@/db/schema";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1a1a1a",
    lineHeight: 1.4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  emitterBlock: { width: "55%" },
  emitterName: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
  emitterLine: { fontSize: 9, color: "#444" },
  invoiceBlock: { width: "40%", textAlign: "right" },
  invoiceTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: "#000",
    marginBottom: 4,
  },
  invoiceNumber: { fontSize: 11, color: "#444", marginBottom: 10 },
  invoiceMetaRow: { fontSize: 9, marginBottom: 2 },
  invoiceMetaLabel: { color: "#777" },
  clientBlock: {
    marginBottom: 24,
    padding: 12,
    backgroundColor: "#f7f7f7",
    borderRadius: 4,
    width: "55%",
    marginLeft: "auto",
  },
  clientLabel: {
    fontSize: 8,
    color: "#888",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  clientName: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  clientLine: { fontSize: 9, color: "#444" },

  table: { marginBottom: 18 },
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1a1a1a",
    paddingBottom: 6,
    marginBottom: 4,
    fontWeight: 700,
    fontSize: 9,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#e5e5e5",
  },
  colDescription: { width: "55%", paddingRight: 8 },
  colQty: { width: "10%", textAlign: "right" },
  colUnit: { width: "15%", textAlign: "right" },
  colTotal: { width: "20%", textAlign: "right" },

  totalsBlock: { marginTop: 8, alignItems: "flex-end" },
  totalsRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsLabel: { fontSize: 10, color: "#444" },
  totalsValue: { fontSize: 10, fontWeight: 700 },
  grandTotalRow: {
    flexDirection: "row",
    width: 220,
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
    marginTop: 4,
  },
  grandTotalValue: { fontSize: 12, fontWeight: 700 },

  paymentBlock: {
    marginTop: 24,
    padding: 12,
    borderWidth: 0.5,
    borderColor: "#ddd",
    borderRadius: 4,
  },
  paymentLine: { fontSize: 9, color: "#444", marginBottom: 2 },
  paymentTitle: { fontSize: 10, fontWeight: 700, marginBottom: 4 },

  signatureBlock: {
    marginTop: 24,
    padding: 14,
    borderWidth: 1,
    borderColor: "#1a1a1a",
    borderRadius: 4,
  },
  signatureTitle: { fontSize: 10, fontWeight: 700, marginBottom: 6 },
  signatureLine: { fontSize: 9, color: "#444", marginBottom: 4 },
  signatureSpace: { height: 50, marginTop: 8 },

  notes: {
    marginTop: 14,
    fontSize: 9,
    color: "#444",
    fontStyle: "italic",
  },

  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    fontSize: 7.5,
    color: "#666",
    lineHeight: 1.5,
  },
});

export function QuotePDF({
  quote,
  lines,
  client,
  profile,
}: {
  quote: Quote;
  lines: QuoteLine[];
  client: Client;
  profile: Profile;
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.emitterBlock}>
            <Text style={styles.emitterName}>{profile.businessName}</Text>
            <Text style={styles.emitterLine}>Entreprise individuelle (EI)</Text>
            {profile.address.split("\n").map((line, i) => (
              <Text key={i} style={styles.emitterLine}>
                {line}
              </Text>
            ))}
            <Text style={styles.emitterLine}>{profile.email}</Text>
            {profile.phone && (
              <Text style={styles.emitterLine}>{profile.phone}</Text>
            )}
            <Text style={[styles.emitterLine, { marginTop: 4 }]}>
              SIRET : {formatSiret(profile.siret)}
            </Text>
          </View>
          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceTitle}>DEVIS</Text>
            <Text style={styles.invoiceNumber}>
              N° {quote.number ?? "BROUILLON"}
            </Text>
            <View style={styles.invoiceMetaRow}>
              <Text>
                <Text style={styles.invoiceMetaLabel}>Émis le </Text>
                {formatDate(quote.issueDate)}
              </Text>
            </View>
            <View style={styles.invoiceMetaRow}>
              <Text>
                <Text style={styles.invoiceMetaLabel}>Valable jusqu&apos;au </Text>
                {formatDate(quote.validUntil)}
              </Text>
            </View>
          </View>
        </View>

        {/* Client */}
        <View style={styles.clientBlock}>
          <Text style={styles.clientLabel}>Devis pour</Text>
          <Text style={styles.clientName}>{client.name}</Text>
          {client.address?.split("\n").map((line, i) => (
            <Text key={i} style={styles.clientLine}>
              {line}
            </Text>
          ))}
          {client.siret && (
            <Text style={styles.clientLine}>
              SIRET : {formatSiret(client.siret)}
            </Text>
          )}
          {client.vatNumber && (
            <Text style={styles.clientLine}>
              N° TVA : {client.vatNumber}
            </Text>
          )}
        </View>

        {/* Lines */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQty}>Qté</Text>
            <Text style={styles.colUnit}>P.U. HT</Text>
            <Text style={styles.colTotal}>Total HT</Text>
          </View>
          {lines.map((line) => (
            <View key={line.id} style={styles.tableRow}>
              <Text style={styles.colDescription}>{line.description}</Text>
              <Text style={styles.colQty}>
                {Number(line.quantity)
                  .toFixed(2)
                  .replace(".", ",")
                  .replace(",00", "")}{" "}
                {rateTypeLabel(line.unitType, Number(line.quantity))}
              </Text>
              <Text style={styles.colUnit}>
                {formatCents(line.unitPriceCents)}
              </Text>
              <Text style={styles.colTotal}>
                {formatCents(line.totalCents)}
              </Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Total HT</Text>
            <Text style={styles.totalsValue}>
              {formatCents(quote.subtotalCents)}
            </Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>TVA</Text>
            <Text style={styles.totalsValue}>—</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={[styles.totalsLabel, { fontSize: 12 }]}>
              Total à régler
            </Text>
            <Text style={styles.grandTotalValue}>
              {formatCents(quote.totalCents)}
            </Text>
          </View>
        </View>

        {/* Payment block (terms applied after acceptance) */}
        <View style={styles.paymentBlock}>
          <Text style={styles.paymentTitle}>
            Modalités de règlement (facture émise après acceptation)
          </Text>
          <Text style={styles.paymentLine}>{quote.paymentTermsText}</Text>
          {profile.iban && (
            <Text style={styles.paymentLine}>
              IBAN : {formatIban(profile.iban)}
              {profile.bic ? `   BIC : ${profile.bic}` : ""}
            </Text>
          )}
        </View>

        {/* Signature block */}
        <View style={styles.signatureBlock}>
          <Text style={styles.signatureTitle}>{QUOTE_ACCEPTANCE_MENTION}</Text>
          <Text style={styles.signatureLine}>
            Date : ________________________
          </Text>
          <Text style={styles.signatureLine}>Signature du client :</Text>
          <View style={styles.signatureSpace} />
        </View>

        {quote.notes && <Text style={styles.notes}>{quote.notes}</Text>}

        {/* Legal footer */}
        <View style={styles.footer} fixed>
          {quote.legalMention.split("\n").map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}

function formatSiret(siret: string): string {
  const clean = siret.replace(/\s/g, "");
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4");
}

function formatIban(iban: string): string {
  const clean = iban.replace(/\s/g, "").toUpperCase();
  return clean.replace(/(.{4})/g, "$1 ").trim();
}
