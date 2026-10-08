import { describe, expect, it } from 'vitest'
import type { LocationFormValues, NewPracticeFormValues, PracticeFormValues } from '../schemas/practice-form'
import {
  locationFormFieldFor,
  toLocationPayload,
  toLocationUpdatePayload,
  toPracticePayload,
} from './payloads'

// The example payloads from the backend, verbatim except where noted. The
// forms must produce exactly these bodies.

describe('practice payload', () => {
  it('builds the practice example from the practice form', () => {
    const values: PracticeFormValues = {
      organizationId: '3',
      code: 'PdV4',
      name: 'Physical Therapy of The City',
      dbaName: 'City PT',
      npi: '1234567893',
      taxId: '12-3456789',
      taxonomyCode: '225100000X',
      address: { line1: '100 Main Street', line2: 'Suite 200', city: 'Brooklyn', state: 'NY', zip: '11209' },
      isActive: true,
    }
    expect(toPracticePayload(values)).toEqual({
      organization_id: 3,
      code: 'PdV4',
      name: 'Physical Therapy of The City',
      dba_name: 'City PT',
      npi: '1234567893',
      tax_id: '12-3456789',
      taxonomy_code: '225100000X',
      address: { line1: '100 Main Street', line2: 'Suite 200', city: 'Brooklyn', state: 'NY', zip: '11209' },
      is_active: true,
    })
  })

  it('carries a new practice’s first location in locations[], in the flat shape', () => {
    const values: NewPracticeFormValues = {
      organizationId: '3',
      code: 'PdV4',
      name: 'Physical Therapy of The City',
      dbaName: 'City PT',
      npi: '1234567893',
      taxId: '12-3456789',
      taxonomyCode: '225100000X',
      address: { line1: '100 Main Street', line2: 'Suite 200', city: 'Brooklyn', state: 'NY', zip: '11209' },
      isActive: true,
      location: {
        code: 'BR003',
        name: 'Bay Ridge',
        npi: '1234567893',
        address: { line1: '7501 3rd Avenue', city: 'Brooklyn', state: 'NY', zip: '11209' },
        placeOfService: '11',
      },
    }
    // Flat, as POST /practices takes it (confirmed 2026-10-07): the street is `address`.
    expect(toPracticePayload(values).locations).toEqual([
      {
        code: 'BR003',
        name: 'Bay Ridge',
        npi: '1234567893',
        address: '7501 3rd Avenue',
        city: 'Brooklyn',
        state: 'NY',
        zipcode: '11209',
        place_of_service: '11',
      },
    ])
  })

  it('leaves optional fields out when empty, as the examples do, and sends no organization as null', () => {
    const payload = toPracticePayload({
      organizationId: null,
      code: 'PdV4',
      name: 'Physical Therapy of The City',
      dbaName: '',
      npi: '1234567893',
      taxId: '12-3456789',
      taxonomyCode: '225100000X',
      address: { line1: '100 Main Street', line2: '', city: 'Brooklyn', state: 'NY', zip: '11209' },
      isActive: false,
    })
    // A save keeps what it leaves out, so an emptied DBA is sent as null, which clears it.
    expect(payload.dba_name).toBeNull()
    expect(payload.address).not.toHaveProperty('line2')
    expect(payload).not.toHaveProperty('locations')
    expect(payload.organization_id).toBeNull()
    expect(payload.is_active).toBe(false)
  })
})

describe('location payload', () => {
  const queens: LocationFormValues = {
    code: 'QN002',
    name: 'Queens',
    npi: '1122334455',
    address: { line1: '37-02 Main Street', city: 'Flushing', state: 'NY', zip: '11354' },
    placeOfService: '11',
    isActive: true,
  }

  // Flat, as POST /locations takes it (the nested example was refused by the server).
  it('adds a location to its practice in the flat shape', () => {
    expect(toLocationPayload(3, queens)).toEqual({
      practice_id: 3,
      code: 'QN002',
      name: 'Queens',
      npi: '1122334455',
      address: '37-02 Main Street',
      city: 'Flushing',
      state: 'NY',
      zipcode: '11354',
      place_of_service: '11',
      is_active: true,
    })
  })

  it('saves a location with every field but practice_id, which the server refuses on a save', () => {
    const payload = toLocationUpdatePayload({ ...queens, isActive: false })
    expect(payload).not.toHaveProperty('practice_id')
    expect(payload).toEqual({
      code: 'QN002',
      name: 'Queens',
      npi: '1122334455',
      address: '37-02 Main Street',
      city: 'Flushing',
      state: 'NY',
      zipcode: '11354',
      place_of_service: '11',
      is_active: false,
    })
  })

  it('puts a server field error on the location form field it belongs to', () => {
    expect(
      ['code', 'address', 'city', 'state', 'zipcode', 'place_of_service', 'is_active'].map(
        locationFormFieldFor,
      ),
    ).toEqual([
      'code',
      'address.line1',
      'address.city',
      'address.state',
      'address.zip',
      'placeOfService',
      'isActive',
    ])
  })
})
