\pset tuples_only on
SELECT 'facilities', count(*) FROM public.facilities;
SELECT 'products', count(*) FROM public.products;
SELECT 'serving_rows', count(*) FROM public.facility_product_duration_admission;
SELECT 'regions', count(*) FROM public.nfz_regions;
SELECT 'population_rows', count(*) FROM public.population_voivodeship;
SELECT 'duplicate_serving_keys', count(*) FROM (
  SELECT ow_nfz,nip,product_code,duration_group,admission_code
  FROM public.facility_product_duration_admission
  GROUP BY 1,2,3,4,5 HAVING count(*) > 1
) q;
SELECT 'orphan_facilities', count(*) FROM public.facility_product_duration_admission d
LEFT JOIN public.facilities f USING (ow_nfz,nip)
WHERE f.nip IS NULL;
SELECT 'orphan_products', count(*) FROM public.facility_product_duration_admission d
LEFT JOIN public.products p USING (product_code)
WHERE p.product_code IS NULL;
SELECT 'hosp_min_sum', sum(hosp_min) FROM public.facility_product_duration_admission;
SELECT 'hosp_sim_sum', sum(hosp_sim) FROM public.facility_product_duration_admission;
SELECT 'deaths_min_sum', sum(deaths_min) FROM public.facility_product_duration_admission;
SELECT 'deaths_sim_sum', sum(deaths_sim) FROM public.facility_product_duration_admission;
