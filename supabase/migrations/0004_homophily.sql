-- The student's own weights for the homophily scorer (src/lib/homophily).
-- One jsonb column, parsed by HomophilyWeightsSchema at the boundary and
-- defaulting to the reference weights when absent or malformed; a new column
-- on student_profiles inherits the owner-only RLS from 0001 for free.
alter table student_profiles
  add column homophily_weights jsonb;

comment on column student_profiles.homophily_weights is
  'HomophilyWeightsSchema: shared_company, shared_club, shared_academic_focus, shared_hometown, shared_university (0-100 each).';
