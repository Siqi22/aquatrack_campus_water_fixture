export interface LeadReportScopeRow {
  proposed_fixture_id?: string | null;
  confirmed_fixture_id?: string | null;
  school_name?: string | null;
  lead_testing_report_uploads?:
    | { district_or_organization?: string | null }
    | Array<{ district_or_organization?: string | null }>
    | null;
}

function normalized(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

export function leadReportRowBelongsToWorkspace(
  row: LeadReportScopeRow,
  fixtureIds: Set<string>,
  districtName: string,
  schoolNames: Set<string>,
) {
  if (row.proposed_fixture_id && fixtureIds.has(row.proposed_fixture_id)) return true;
  if (row.confirmed_fixture_id && fixtureIds.has(row.confirmed_fixture_id)) return true;

  const upload = Array.isArray(row.lead_testing_report_uploads)
    ? row.lead_testing_report_uploads[0]
    : row.lead_testing_report_uploads;
  const rowDistrict = normalized(upload?.district_or_organization);
  if (rowDistrict && rowDistrict === normalized(districtName)) return true;

  return Boolean(normalized(row.school_name)) && schoolNames.has(normalized(row.school_name));
}
