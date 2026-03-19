import * as React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Icon from '@mui/material/Icon';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';

type UserRow = {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  anomalies: {
    filename: string;
    docType: string;
    status: string;
    message: string;
  }[];
};

export type UserTableData = {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  anomalies: {
    filename: string;
    docType: string;
    status: string;
    message: string;
  }[];
};

function createData(
  id: string,
  username: string,
  email: string,
  createdAt: Date,
  anomalies: UserRow["anomalies"],
): UserRow {
    return {
      id,
      username,
      email,
      createdAt,
      anomalies,
    };
  }

  function Row(props: { row: UserRow }) {
    const { row } = props;
    const [open, setOpen] = React.useState(false);
    const hasAnomaly = row.anomalies.length > 0;
  
    return (
      <React.Fragment>
        <TableRow sx={{ '& > *': { borderBottom: 'unset' } }}>
          <TableCell>
            <IconButton
              aria-label="expand row"
              size="small"
              onClick={() => setOpen(!open)}
            >
              <Icon fontSize="small">{open ? '-' : '+'}</Icon>
            </IconButton>
          </TableCell>
          <TableCell component="th" scope="row">
            {row.username}
          </TableCell>
          <TableCell align="right">{row.email}</TableCell>
          <TableCell align="right">{row.createdAt.toLocaleDateString('fr-FR')}</TableCell>
          <TableCell align="center">
            {hasAnomaly ? '⚠️' : null}
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
            <Collapse in={open} timeout="auto" unmountOnExit>
              <Box sx={{ margin: 1 }}>
                <Typography variant="h6" gutterBottom component="div">
                  Anomalies
                </Typography>
                <Table size="small" aria-label="anomalies">
                  <TableBody>
                    {row.anomalies.map((anomaly, index) => (
                      <TableRow key={`${anomaly.docType}-${anomaly.status}-${index}`}>
                        <TableCell>
                          {`[${anomaly.filename}] est ${anomaly.status} avec comme erreur : ${anomaly.message}`}
                        </TableCell>
                      </TableRow>
                    ))}
                    {row.anomalies.length === 0 ? (
                      <TableRow>
                        <TableCell>Aucune anomalie</TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      </React.Fragment>
    );
  }

type UsersTableProps = {
  users: UserTableData[];
};

export default function CollapsibleTable({ users }: UsersTableProps) {
    const [searchValue, setSearchValue] = React.useState('');

    const rows: UserRow[] = users.map((user) =>
      createData(user.id, user.username, user.email, user.createdAt, user.anomalies)
    );

    const filteredRows = rows.filter((row) => {
      if (!searchValue.trim()) {
        return true;
      }
      const normalizedSearch = searchValue.toLowerCase();
      return (
        row.username.toLowerCase().includes(normalizedSearch) ||
        row.email.toLowerCase().includes(normalizedSearch)
      );
    });

    return (
      <TableContainer component={Paper}>
        <Stack spacing={2} sx={{ width: 300, p: 2 }}>
          <Autocomplete
            freeSolo
            id="users-search"
            disableClearable
            options={[]}
            open={false}
            forcePopupIcon={false}
            onInputChange={(_, newValue) => setSearchValue(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Rechercher un utilisateur"
                slotProps={{
                  input: {
                    ...params.InputProps,
                    type: 'search',
                  },
                }}
              />
            )}
          />
        </Stack>
        <Table aria-label="collapsible table">
          <TableHead>
            <TableRow>
              <TableCell />
              <TableCell>Nom d'utilisateur</TableCell>
              <TableCell align="right">Email</TableCell>
              <TableCell align="right">Date de creation</TableCell>
              <TableCell align="center" />
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRows.map((row) => (
              <Row key={row.email} row={row} />
            ))}
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Aucun utilisateur trouve
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }