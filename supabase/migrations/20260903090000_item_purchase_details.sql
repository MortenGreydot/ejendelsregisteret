-- Købsoplysninger på ejendele.
--
-- Registeret kunne dokumentere HVAD man ejer, men ikke hvad det kostede,
-- hvornår det blev købt eller hvor. Præcis de oplysninger er det et
-- forsikringsselskab spørger om, og uden dem er dokumentationen kun det
-- halve bevis: den viser at genstanden fandtes, ikke hvad den var værd.
--
-- Felterne er alle valgfri. En cykel arvet fra en onkel har hverken
-- kvittering eller forhandler, og den skal stadig kunne registreres.

alter table public.items
  add column if not exists model          text,
  add column if not exists purchase_date  date,
  add column if not exists purchase_price numeric(10,2),
  add column if not exists current_value  numeric(10,2),
  add column if not exists retailer       text;

comment on column public.items.model is
  'Modelbetegnelse. Adskiller to varianter af samme mærke og produkt.';
comment on column public.items.purchase_date is
  'Købsdato. Dato uden klokkeslæt — ingen husker hvornår på dagen.';
comment on column public.items.purchase_price is
  'Købspris i kroner, som betalt. Ikke nedskrevet værdi.';
comment on column public.items.current_value is
  'Ejerens egen vurdering i dag. Bruges ved erstatning, hvor genanskaffelse sjældent er lig købspris.';
comment on column public.items.retailer is
  'Hvor den blev købt. Butik, webshop eller privat sælger.';

-- Negative beløb er altid en tastefejl, og en tastefejl i et bevis er
-- værre end et tomt felt. NULL er stadig tilladt — feltet er valgfrit.
alter table public.items
  add constraint items_purchase_price_ikke_negativ
    check (purchase_price is null or purchase_price >= 0),
  add constraint items_current_value_ikke_negativ
    check (current_value is null or current_value >= 0);

-- En fremtidig købsdato er ligeledes en tastefejl, men den fanges i
-- formularen med max på datofeltet og ikke her. En CHECK der kalder
-- current_date er ikke immutable: den gør en genindlæsning af et dump
-- afhængig af hvilken dag den køres, og en række der var gyldig ved
-- indsættelsen kan vælte restoren et år senere.

-- Kolonnerne arver tabellens grants og RLS-policies: brugeren kan læse og
-- rette sine egne rækker, og ingen andres. Intet nyt at tilføje der.
