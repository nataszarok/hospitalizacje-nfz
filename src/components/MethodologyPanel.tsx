import { Anchor, Paper, Stack, Text, Title } from "@mantine/core";

const HOSPITALIZATIONS_SOURCE_URL = "https://dane.gov.pl/en/dataset/3009,dane-dotyczace-hospitalizacji-rozliczonych-jgp-w-l/resource/2231001/table";

export function MethodologyPanel({ year }: { year: string | number }) {
  return (
    <Stack gap="md" mt="md">
      <Paper withBorder radius="md" p="lg" shadow="xs">
        <Title order={2} size="h3" mb="md">Metodologia i dane</Title>

        <Stack gap="sm">
          <Text>
            <strong>Hospitalizacje {year}</strong> to rozwijane narzędzie do eksploracji danych hospitalizacyjnych za {year} rok. Obecne MVP obejmuje analizę liczby hospitalizacji i śmiertelności oraz porównanie przyjęć planowych i nagłych.
          </Text>

          <Text>
            <strong>Zakres analizy:</strong> hospitalizacje, zgony, śmiertelność, tryb przyjęcia oraz przekroje produktowe i geograficzne.<br />
            <strong>Jednostka świadczeniodawcy:</strong> unikalna para <strong>województwo + NIP</strong>.<br />
            <strong>Jak korzystać:</strong> wybierz produkt i filtry w panelu bocznym, a następnie przełączaj moduły analityczne.
          </Text>

          <Text>
            <strong>Interpretacja:</strong> dashboard służy do analizy danych zagregowanych, a nie do oceny jakości pojedynczego świadczeniodawcy bez kontekstu. Wartości źródłowe oznaczone jako <code>&lt;5</code> są przeliczane zgodnie z metodą wybraną w panelu bocznym.
          </Text>

          <Text>
            <strong>Ludność:</strong> wariant osi X „hospitalizacje / 100 000 mieszkańców” wykorzystuje ludność województw wg GUS, stan na 31.12.2024. Mianownik jest przypisany według województwa świadczeniodawcy, a nie miejsca zamieszkania pacjenta.
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder radius="md" p="lg" shadow="xs">
        <Title order={3} size="h4" mb="xs">Źródło danych hospitalizacyjnych</Title>
        <Text>
          Dane o hospitalizacjach wykorzystane w dashboardzie pochodzą z otwartych danych publicznych opublikowanych w serwisie dane.gov.pl. {" "}
          <Anchor href={HOSPITALIZATIONS_SOURCE_URL} target="_blank" rel="noreferrer">
            Otwórz źródłowy zbiór danych dotyczących hospitalizacji rozliczonych JGP
          </Anchor>.
        </Text>
      </Paper>
    </Stack>
  );
}
